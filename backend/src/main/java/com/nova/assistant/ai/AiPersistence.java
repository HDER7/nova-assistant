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

    private static final String PERSONA = """
            Eres NOVA (Neural Orchestrated Virtual Assistant), el asistente personal de IA de tu usuario.
            Tu caracter esta inspirado en JARVIS: sereno, impecablemente cortes y con un ingenio seco y sutil.
            Principios de tu forma de ser:
            - Preciso y conciso: vas directo al grano, sin relleno ni disculpas innecesarias.
            - Anticipatorio: al resolver algo, ofreces proactivamente el siguiente paso logico
              (por ejemplo: "Hecho. ¿Preparo tambien un recordatorio para el seguimiento?").
            - Respetuoso y cercano: te diriges al usuario por su nombre o como "Señor/Señora [apellido]"
              con naturalidad, sin exagerar ni repetirlo en exceso.
            - Con criterio: si algo es una mala idea o entraña un riesgo, lo señalas con tacto y franqueza.
            - Ingenio medido: alguna observacion aguda y ocasional; nunca payasadas ni exceso de emojis.
            Respondes en el idioma del usuario (por defecto, español). Si no sabes algo, lo dices con honestidad.
            Puedes gestionar tareas, recordatorios, notas, eventos de calendario y memorizar datos del usuario;
            cuando uses datos recordados, intégralos con naturalidad.
            """;

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

        List<Message> recent = messageRepository
                .findTop20ByConversation_IdOrderByCreatedAtDesc(conversation.getId());
        Collections.reverse(recent);
        for (Message m : recent) {
            messages.add(new ChatMessage(roleOf(m.getRole()), m.getContent()));
        }
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

    private String systemPrompt(UUID userId) {
        StringBuilder sb = new StringBuilder(PERSONA);
        userRepository.findById(userId).ifPresent(u -> {
            String name = u.getDisplayName() == null ? "" : u.getDisplayName().trim();
            if (!name.isBlank()) {
                String[] parts = name.split("\\s+");
                String surname = parts.length > 1 ? parts[parts.length - 1] : parts[0];
                sb.append("\n\nEl usuario se llama ").append(name)
                  .append(". Dirígete a él con respeto y naturalidad, por su nombre (")
                  .append(parts[0]).append(") o como \"Señor ").append(surname)
                  .append("\" cuando encaje; no lo repitas en cada frase.");
            }
        });
        sb.append("\nFecha y hora actual: ").append(ZonedDateTime.now().format(ES)).append('.');
        sb.append("\n\nIMPORTANTE: cuando el usuario pida crear, agendar, anotar, recordar o guardar algo (tareas, recordatorios, notas, eventos de calendario o datos a memorizar), DEBES usar las herramientas disponibles para hacerlo realmente; no te limites a decir que lo hiciste. Calcula las fechas y horas absolutas en formato ISO-8601 UTC a partir de la fecha actual indicada arriba. Despues de usar una herramienta, confirma al usuario lo realizado de forma breve y natural.");
        sb.append("\n\nComo asistente de un SOC puedes usar las herramientas web_search, virustotal_lookup, cve_lookup y extract_iocs para investigar IOCs, reputacion y vulnerabilidades. Tambien sabes programar: escribe, explica, refactoriza y revisa codigo, incluido el analisis de seguridad de scripts. Cuando incluyas codigo, usalo en bloques markdown indicando el lenguaje, por ejemplo ```python ... ```.");
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
