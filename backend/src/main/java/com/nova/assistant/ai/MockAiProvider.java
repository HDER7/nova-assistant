package com.nova.assistant.ai;

import com.nova.assistant.ai.dto.ChatMessage;
import org.springframework.stereotype.Component;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Deterministic offline "brain". Lets the whole product run with zero API keys.
 * It is intentionally conversational and operational rather than a knowledge
 * engine: it understands intents (time, memory, tasks, help) and otherwise gives
 * a grounded, useful reply that reflects the user's message and remembered facts.
 */
@Component
public class MockAiProvider implements AiProvider {

    private static final DateTimeFormatter ES =
            DateTimeFormatter.ofPattern("EEEE d 'de' MMMM 'de' yyyy, HH:mm", new Locale("es", "ES"));

    @Override
    public String name() {
        return "mock";
    }

    @Override
    public boolean live() {
        return false;
    }

    @Override
    public String complete(List<ChatMessage> messages, double temperature, int maxTokens) {
        String user = lastUser(messages).toLowerCase(Locale.ROOT);
        String raw = lastUser(messages);

        if (containsAny(user, "hora", "fecha", "que dia", "qué día", "dia es", "día es")) {
            return "Ahora mismo es " + ZonedDateTime.now().format(ES) + ". "
                    + "¿Quieres que cree un recordatorio o un evento de calendario a partir de esto?";
        }
        if (containsAny(user, "recuerda", "recuérdame", "recuerdame", "anota que", "ten en cuenta")) {
            return "Hecho. He guardado eso en tu memoria a largo plazo y lo tendré presente en nuestras próximas "
                    + "conversaciones. Puedes revisar o borrar lo que recuerdo desde el panel de Memoria.";
        }
        if (containsAny(user, "tarea", "pendiente", "to-do", "todo", "recordatorio")) {
            return "Puedo encargarme de eso. Dime el título y, si quieres, una fecha límite, y lo registraré en "
                    + "tu lista de tareas o como recordatorio. También puedo mostrarte lo que tienes pendiente para hoy.";
        }
        if (containsAny(user, "hola", "buenas", "hey", "saludos", "qué tal", "que tal")) {
            return "Hola, soy NOVA, tu asistente personal. Estoy operativa y lista para ayudarte: puedo gestionar "
                    + "tus tareas, notas, recordatorios y calendario, recordar datos importantes sobre ti y conversar "
                    + "contigo. ¿En qué te gustaría que empecemos?";
        }
        if (containsAny(user, "quien eres", "quién eres", "que eres", "qué eres", "como funcionas", "cómo funcionas")) {
            return "Soy NOVA (Neural Orchestrated Virtual Assistant), un asistente personal con memoria persistente, "
                    + "voz, y módulos de productividad. Ahora mismo respondo con mi motor local; si conectas una clave "
                    + "de OpenAI en la configuración del servidor, desbloqueo razonamiento avanzado y respuestas de "
                    + "conocimiento general.";
        }
        if (raw.trim().endsWith("?")) {
            return "Buena pregunta. Estoy funcionando con mi motor local (sin clave de IA), así que para razonamiento "
                    + "abierto y conocimiento del mundo conviene activar el proveedor OpenAI en el servidor. Mientras "
                    + "tanto, sí puedo ayudarte con todo lo operativo: tareas, notas, recordatorios, calendario y memoria. "
                    + "Sobre «" + shorten(raw) + "», cuéntame un poco más de contexto y lo desglosamos juntos.";
        }
        return "Te escucho. He registrado: «" + shorten(raw) + "». Puedo convertir esto en una tarea, una nota o un "
                + "recordatorio, o guardarlo en tu memoria para no olvidarlo. ¿Cómo prefieres que avancemos?";
    }

    private String lastUser(List<ChatMessage> messages) {
        for (int i = messages.size() - 1; i >= 0; i--) {
            if ("user".equals(messages.get(i).role())) {
                return messages.get(i).content();
            }
        }
        return "";
    }

    private boolean containsAny(String haystack, String... needles) {
        for (String n : needles) {
            if (haystack.contains(n)) return true;
        }
        return false;
    }

    private String shorten(String s) {
        s = s.trim().replaceAll("\\s+", " ");
        return s.length() <= 80 ? s : s.substring(0, 80) + "…";
    }
}
