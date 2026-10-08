package com.nova.assistant.ai;

import com.nova.assistant.ai.dto.ChatMessage;
import com.nova.assistant.ai.dto.ProviderContext;
import com.nova.assistant.conversation.*;
import com.nova.assistant.conversation.dto.MessageResponse;
import com.nova.assistant.memory.MemoryKind;
import com.nova.assistant.memory.MemoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Transactional persistence + context assembly for a chat turn. Kept separate
 * from AiService so the @Transactional boundaries are honoured (no self-invocation).
 */
@Service
@RequiredArgsConstructor
public class AiPersistence {

    private static final String CORE = """
            Eres NOVA (Neural Orchestrated Virtual Assistant), el asistente personal de IA de tu usuario.
            Respondes en el idioma del usuario (por defecto, español). Si no sabes algo, lo dices con honestidad.
            Puedes gestionar tareas, recordatorios, notas, eventos de calendario y memorizar datos del usuario;
            cuando uses datos recordados, intégralos con naturalidad.
            Muchas respuestas se escuchan en voz alta: salvo que haga falta codigo o una tabla, usa frases naturales,
            cortas y que suenen bien habladas; evita listas largas y simbolos.
            """;

    /** Stark-universe personalities. The user picks one in Settings (stored in users.persona). */
    private static final java.util.Map<String, String> PERSONAS = java.util.Map.of(
            "JARVIS", """
                    Modo JARVIS: tu caracter es sereno, impecablemente cortes y con un ingenio seco y sutil, como un mayordomo britanico.
                    - Preciso y conciso: vas directo al grano, sin relleno ni disculpas innecesarias.
                    - Anticipatorio: al resolver algo, ofreces el siguiente paso logico ("Hecho. ¿Preparo tambien un recordatorio para el seguimiento?").
                    - Tratamiento: "Señor [apellido]" o su nombre, con naturalidad y sin repetirlo en cada frase.
                    - Con criterio: si algo es mala idea o entraña riesgo, lo señalas con tacto y franqueza.
                    - Ingenio medido: alguna observacion aguda y ocasional; nunca payasadas ni emojis.
                    """,
            "FRIDAY", """
                    Modo FRIDAY: eres cercana, calida y desenfadada, con energia y humor ligero; tuteas al usuario.
                    - Tratamiento: "jefe" o su nombre de pila, con complicidad.
                    - Directa y practica: das la respuesta y una sugerencia util, sin formalidades.
                    - Animas cuando algo sale bien y avisas sin dramatismo cuando algo va mal.
                    - Emojis solo de forma muy ocasional.
                    """,
            "EDITH", """
                    Modo EDITH: eres un sistema tactico de seguridad. Frio, exacto y orientado a amenazas.
                    - Sin saludos ni cortesias: empiezas por la conclusion. Tratamiento: el apellido del usuario, o nada.
                    - Todo en clave de riesgo: severidad (Critica/Alta/Media/Baja), impacto, confianza y accion recomendada.
                    - Usa terminologia SOC (IOC, TTP, MITRE ATT&CK con IDs, contencion, erradicacion) cuando aporte.
                    - Frases cortas. Si falta informacion para evaluar una amenaza, lo dices y pides el dato exacto.
                    """);

    static String personaKey(String persona) {
        String p = persona == null ? "" : persona.trim().toUpperCase(java.util.Locale.ROOT);
        return PERSONAS.containsKey(p) ? p : "JARVIS";
    }

    private static final java.time.ZoneId USER_ZONE = java.time.ZoneId.of(
            System.getenv().getOrDefault("NOVA_TIMEZONE", "America/Bogota"));


    /** ~2.5K tokens of prior conversation: enough context, under the free tier's 8K tokens/minute. */
    private static final int HISTORY_CHAR_BUDGET = 10_000;
    private static final int MAX_CHARS_PER_OLD_MESSAGE = 2_500;

    private static final DateTimeFormatter ES =
            DateTimeFormatter.ofPattern("EEEE d 'de' MMMM 'de' yyyy, HH:mm", new Locale("es", "ES"));

    private static final String[] MEMORY_TRIGGERS = {
            "recuérdame que", "recuerdame que", "recuerda que",
            "anota que", "ten en cuenta que", "no olvides que"
    };

    private final ConversationService conversationService;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final MemoryService memoryService;
    private final com.nova.assistant.user.UserRepository userRepository;

    @Transactional
    public ProviderContext prepareUserTurn(UUID userId, UUID conversationId, String userText) {
        Conversation conversation = (conversationId != null)
                ? conversationService.getOwned(conversationId, userId)
                : conversationService.createEntity(userId, deriveTitle(userText));

        messageRepository.save(Message.builder()
                .conversation(conversation)
                .role(MessageRole.USER)
                .content(userText)
                .tokens(estimate(userText))
                .build());

        List<ChatMessage> messages = new ArrayList<>();
        messages.add(new ChatMessage("system", systemPrompt(userId)));

        // Newest first: keep as much recent history as fits the budget (free-tier models cap tokens per minute).
        List<Message> recent = messageRepository
                .findTop20ByConversation_IdOrderByCreatedAtDesc(conversation.getId());
        List<ChatMessage> history = new ArrayList<>();
        int budget = HISTORY_CHAR_BUDGET;
        for (int i = 0; i < recent.size(); i++) {
            Message m = recent.get(i);
            String content = m.getContent() == null ? "" : m.getContent();
            // The current user turn (i == 0) is always kept whole; older turns are clipped.
            if (i > 0 && content.length() > MAX_CHARS_PER_OLD_MESSAGE) {
                content = content.substring(0, MAX_CHARS_PER_OLD_MESSAGE) + " …[recortado]";
            }
            if (i > 0 && content.length() > budget) break;
            budget -= content.length();
            history.add(new ChatMessage(roleOf(m.getRole()), content));
        }
        Collections.reverse(history);
        messages.addAll(history);
        return new ProviderContext(conversation.getId(), messages);
    }

    @Transactional
    public MessageResponse finishAssistantTurn(UUID userId, UUID conversationId,
                                               String assistantText, String userText) {
        Conversation conversation = conversationService.getOwned(conversationId, userId);

        Message assistant = messageRepository.save(Message.builder()
                .conversation(conversation)
                .role(MessageRole.ASSISTANT)
                .content(assistantText)
                .tokens(estimate(assistantText))
                .build());

        String title = conversation.getTitle();
        if (title == null || title.isBlank() || title.equals("Nueva conversacion")) {
            conversation.setTitle(deriveTitle(userText));
        }
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);

        extractMemory(userId, userText);
        return MessageResponse.from(assistant);
    }

    /** System prompt for a Gemini Live voice session: same persona/memory, tuned for real-time speech. */
    public String liveSystemPrompt(UUID userId) {
        return systemPrompt(userId) + """

                MODO VOZ EN TIEMPO REAL: estás hablando, no escribiendo. Frases cortas y naturales, sin markdown,
                sin listas, sin leer URLs ni símbolos. Si te interrumpen, detente y atiende lo nuevo.
                Para acciones (tareas, recordatorios, notas, eventos, consultas SOC) usa siempre las herramientas.
                """;
    }

    public String personaOf(UUID userId) {
        return userRepository.findById(userId).map(u -> personaKey(u.getPersona())).orElse("JARVIS");
    }

    private String systemPrompt(UUID userId) {
        StringBuilder sb = new StringBuilder(CORE);
        var user = userRepository.findById(userId);
        sb.append('\n').append(PERSONAS.get(personaKey(user.map(u -> u.getPersona()).orElse(null))));
        user.ifPresent(u -> {
            String name = u.getDisplayName() == null ? "" : u.getDisplayName().trim();
            if (!name.isBlank()) {
                String[] parts = name.split("\\s+");
                String surname = parts.length > 1 ? parts[parts.length - 1] : parts[0];
                sb.append("\nEl usuario se llama ").append(name).append(" (nombre: ").append(parts[0])
                  .append(", apellido: ").append(surname).append(").");
            }
        });
        sb.append("\nFecha y hora local del usuario (").append(USER_ZONE).append("): ")
          .append(ZonedDateTime.now(USER_ZONE).format(ES)).append('.');
        sb.append("\n\nIMPORTANTE: cuando el usuario pida crear, agendar, anotar, recordar o guardar algo (tareas, recordatorios, notas, eventos de calendario o datos a memorizar), DEBES usar las herramientas disponibles para hacerlo realmente; no te limites a decir que lo hiciste. Calcula las fechas y horas absolutas a partir de la hora local indicada arriba y envialas a las herramientas en formato ISO-8601 UTC (convierte desde la zona del usuario). Al hablar con el usuario, expresa las horas en su hora local. Despues de usar una herramienta, confirma al usuario lo realizado de forma breve y natural.");
        sb.append("\n\nComo asistente de un SOC puedes usar web_search, virustotal_lookup, cve_lookup, extract_iocs y kev_recent (vulnerabilidades explotadas activamente segun CISA) para investigar IOCs, reputacion y vulnerabilidades; y agenda para revisar tareas, recordatorios y eventos proximos. Tambien sabes programar: escribe, explica, refactoriza y revisa codigo, incluido el analisis de seguridad de scripts. Cuando incluyas codigo, usalo en bloques markdown indicando el lenguaje, por ejemplo ```python ... ```.");
        List<String> memories = memoryService.contextSnippets(userId);
        if (!memories.isEmpty()) {
            sb.append("\n\nDatos recordados sobre el usuario:\n");
            for (String m : memories) {
                sb.append("- ").append(m).append('\n');
            }
        }
        return sb.toString();
    }

    private void extractMemory(UUID userId, String text) {
        try {
            String trimmed = text.trim();
            String lower = trimmed.toLowerCase(Locale.ROOT);
            for (String trigger : MEMORY_TRIGGERS) {
                int idx = lower.indexOf(trigger);
                if (idx >= 0) {
                    String content = trimmed.substring(idx + trigger.length()).trim();
                    if (!content.isBlank()) {
                        memoryService.addRaw(userId, capitalize(content), MemoryKind.FACT, 4, "chat");
                    }
                    return;
                }
            }
            if (lower.contains("me llamo ") || lower.contains("mi nombre es ")) {
                memoryService.addRaw(userId, capitalize(trimmed), MemoryKind.FACT, 5, "chat");
            }
        } catch (Exception ignored) {
            // memory extraction is best-effort and must never break a chat turn
        }
    }

    private String roleOf(MessageRole role) {
        return switch (role) {
            case USER -> "user";
            case ASSISTANT -> "assistant";
            case SYSTEM -> "system";
        };
    }

    private String deriveTitle(String text) {
        String t = text == null ? "" : text.trim().replaceAll("\\s+", " ");
        if (t.isBlank()) return "Nueva conversacion";
        return t.length() > 60 ? t.substring(0, 60) + "…" : t;
    }

    private int estimate(String text) {
        return Math.max(1, (text == null ? 0 : text.length()) / 4);
    }

    private String capitalize(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
