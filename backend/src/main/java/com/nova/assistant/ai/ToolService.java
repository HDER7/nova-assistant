package com.nova.assistant.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nova.assistant.calendar.CalendarService;
import com.nova.assistant.calendar.CreateEventRequest;
import com.nova.assistant.memory.MemoryService;
import com.nova.assistant.memory.dto.CreateMemoryRequest;
import com.nova.assistant.note.CreateNoteRequest;
import com.nova.assistant.note.NoteService;
import com.nova.assistant.reminder.CreateReminderRequest;
import com.nova.assistant.reminder.ReminderService;
import com.nova.assistant.task.CreateTaskRequest;
import com.nova.assistant.task.TaskResponse;
import com.nova.assistant.task.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Exposes NOVA's actions as OpenAI-style "tools" and executes the model's tool calls,
 * so the assistant can really create tasks, reminders, notes, events and memories.
 */
@Service
@RequiredArgsConstructor
public class ToolService {

    private final TaskService taskService;
    private final ReminderService reminderService;
    private final NoteService noteService;
    private final CalendarService calendarService;
    private final MemoryService memoryService;
    private final ObjectMapper mapper;

    public List<Map<String, Object>> toolSpecs() {
        List<Map<String, Object>> tools = new ArrayList<>();
        tools.add(fn("create_task", "Crea una tarea para el usuario.",
                Map.of("title", str("Titulo de la tarea"),
                        "description", str("Descripcion opcional"),
                        "priority", enumStr("Prioridad", "LOW", "MEDIUM", "HIGH", "URGENT"),
                        "dueAt", str("Fecha limite en ISO-8601 UTC, ej 2026-06-15T14:00:00Z")),
                List.of("title")));
        tools.add(fn("create_reminder", "Crea un recordatorio con fecha y hora.",
                Map.of("title", str("Que recordar"),
                        "remindAt", str("Fecha/hora del recordatorio en ISO-8601 UTC"),
                        "notes", str("Notas opcionales"),
                        "recurrence", enumStr("Recurrencia", "NONE", "DAILY", "WEEKLY", "MONTHLY")),
                List.of("title", "remindAt")));
        tools.add(fn("create_note", "Crea una nota.",
                Map.of("title", str("Titulo opcional"),
                        "content", str("Contenido de la nota"),
                        "tags", arrStr("Etiquetas opcionales")),
                List.of("content")));
        tools.add(fn("create_calendar_event", "Crea un evento de calendario.",
                Map.of("title", str("Titulo del evento"),
                        "startAt", str("Inicio en ISO-8601 UTC"),
                        "endAt", str("Fin en ISO-8601 UTC"),
                        "location", str("Ubicacion opcional"),
                        "description", str("Descripcion opcional")),
                List.of("title", "startAt", "endAt")));
        tools.add(fn("save_memory", "Guarda un dato importante sobre el usuario en su memoria a largo plazo.",
                Map.of("content", str("El dato a recordar"),
                        "kind", enumStr("Tipo", "FACT", "PREFERENCE", "EVENT", "GOAL"),
                        "importance", Map.of("type", "integer", "description", "Importancia 1-5")),
                List.of("content")));
        tools.add(fn("list_tasks", "Lista las tareas del usuario, opcionalmente filtradas por estado.",
                Map.of("status", enumStr("Estado", "TODO", "IN_PROGRESS", "DONE")),
                List.of()));
        return tools;
    }

    public String execute(UUID userId, String name, String argsJson) {
        try {
            JsonNode a = (argsJson == null || argsJson.isBlank())
                    ? mapper.createObjectNode() : mapper.readTree(argsJson);
            return switch (name == null ? "" : name) {
                case "create_task" -> {
                    TaskResponse r = taskService.create(userId, new CreateTaskRequest(
                            text(a, "title"), text(a, "description"), text(a, "priority"), instant(a, "dueAt")));
                    yield "OK. Tarea creada: \"" + r.title() + "\" [" + r.priority() + "]"
                            + (r.dueAt() != null ? ", vence " + r.dueAt() : "");
                }
                case "create_reminder" -> {
                    Instant when = instant(a, "remindAt");
                    if (when == null) yield "ERROR: falta remindAt (fecha/hora ISO-8601) para el recordatorio.";
                    var r = reminderService.create(userId, new CreateReminderRequest(
                            text(a, "title"), text(a, "notes"), when, text(a, "recurrence")));
                    yield "OK. Recordatorio creado: \"" + r.title() + "\" para " + r.remindAt();
                }
                case "create_note" -> {
                    var r = noteService.create(userId, new CreateNoteRequest(
                            text(a, "title"), text(a, "content"), stringList(a, "tags")));
                    yield "OK. Nota creada: \"" + r.title() + "\".";
                }
                case "create_calendar_event" -> {
                    Instant s = instant(a, "startAt");
                    Instant e = instant(a, "endAt");
                    if (s == null || e == null) yield "ERROR: faltan startAt/endAt (ISO-8601) para el evento.";
                    var r = calendarService.create(userId, new CreateEventRequest(
                            text(a, "title"), text(a, "description"), text(a, "location"), s, e, false, "cyan"));
                    yield "OK. Evento creado: \"" + r.title() + "\" (" + r.startAt() + " - " + r.endAt() + ").";
                }
                case "save_memory" -> {
                    Integer imp = (a.has("importance") && a.get("importance").canConvertToInt())
                            ? a.get("importance").asInt() : null;
                    var r = memoryService.add(userId, new CreateMemoryRequest(
                            text(a, "content"), text(a, "kind"), imp));
                    yield "OK. Memoria guardada: \"" + r.content() + "\".";
                }
                case "list_tasks" -> {
                    String status = text(a, "status");
                    List<TaskResponse> list = taskService.list(userId, status);
                    if (list.isEmpty()) yield "No hay tareas" + (status != null ? " en estado " + status : "") + ".";
                    StringBuilder sb = new StringBuilder("Tareas:\n");
                    for (TaskResponse t : list) {
                        sb.append("- ").append(t.title()).append(" [").append(t.status())
                                .append("/").append(t.priority()).append("]\n");
                    }
                    yield sb.toString();
                }
                default -> "ERROR: funcion no soportada: " + name;
            };
        } catch (Exception ex) {
            return "ERROR ejecutando " + name + ": " + ex.getMessage();
        }
    }

    // ---- schema helpers ----
    private Map<String, Object> fn(String name, String desc, Map<String, Object> props, List<String> required) {
        return Map.of("type", "function", "function", Map.of(
                "name", name, "description", desc,
                "parameters", Map.of("type", "object", "properties", props, "required", required)));
    }
    private Map<String, Object> str(String desc) { return Map.of("type", "string", "description", desc); }
    private Map<String, Object> arrStr(String desc) {
        return Map.of("type", "array", "items", Map.of("type", "string"), "description", desc);
    }
    private Map<String, Object> enumStr(String desc, String... values) {
        return Map.of("type", "string", "description", desc, "enum", List.of(values));
    }

    // ---- argument helpers ----
    private String text(JsonNode a, String k) { return a.hasNonNull(k) ? a.get(k).asText() : null; }
    private List<String> stringList(JsonNode a, String k) {
        List<String> out = new ArrayList<>();
        if (a.has(k) && a.get(k).isArray()) for (JsonNode n : a.get(k)) out.add(n.asText());
        return out;
    }
    private Instant instant(JsonNode a, String k) {
        String s = text(a, k);
        if (s == null || s.isBlank()) return null;
        try { return Instant.parse(s); } catch (Exception ignore) { }
        try { return OffsetDateTime.parse(s).toInstant(); } catch (Exception ignore) { }
        try { return LocalDateTime.parse(s).toInstant(ZoneOffset.UTC); } catch (Exception ignore) { }
        return null;
    }
}
