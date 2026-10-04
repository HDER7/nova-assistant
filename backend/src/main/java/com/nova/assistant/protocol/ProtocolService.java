package com.nova.assistant.protocol;

import com.nova.assistant.common.ApiException;
import com.nova.assistant.user.User;
import com.nova.assistant.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Stark-style protocols: named routines triggered by voice ("NOVA, protocolo inicio de turno").
 * Built-in protocols ship with NOVA; the user can add their own or override a built-in by name.
 * A matched protocol is expanded into explicit instructions the agent executes with its tools.
 */
@Service
@RequiredArgsConstructor
public class ProtocolService {

    private record BuiltIn(String name, List<String> aliases, String steps) { }

    private static final List<BuiltIn> BUILT_INS = List.of(
            new BuiltIn("inicio de turno", List.of("inicio turno", "inicio", "arranque", "inicio del turno"), """
                    1) Usa la herramienta agenda (24 horas) para revisar tareas vencidas o por vencer, recordatorios y eventos.
                    2) Usa kev_recent (3 dias) para detectar vulnerabilidades nuevas explotadas activamente.
                    3) Entrega un parte de inicio de turno: primero lo urgente (vencido, KEV usadas en ransomware), luego el resto. Maximo 6 frases."""),
            new BuiltIn("cierre de turno", List.of("fin de turno", "cierre", "relevo", "cierre del turno"), """
                    1) Usa list_tasks con estado IN_PROGRESS y luego con estado TODO.
                    2) Usa la herramienta agenda (16 horas) para lo que viene en el proximo turno.
                    3) Crea una nota titulada "Relevo de turno" con: tareas en curso, proximos vencimientos y observaciones para quien recibe el turno.
                    4) Confirma en 3-4 frases que quedo registrado en la nota."""),
            new BuiltIn("radar de amenazas", List.of("amenazas", "radar", "threat intel", "inteligencia de amenazas"), """
                    1) Usa kev_recent (7 dias).
                    2) Para las 2 vulnerabilidades mas criticas (primero las usadas en ransomware) usa cve_lookup para obtener su CVSS.
                    3) Resume: fabricantes afectados, accion requerida por CISA y prioridad de parcheo recomendada."""),
            new BuiltIn("concentracion", List.of("concentración", "foco", "modo foco", "enfoque"), """
                    1) Usa la herramienta agenda (4 horas).
                    2) Propón en 2 frases la tarea mas importante en la que concentrarse ahora y por que.
                    3) Crea un recordatorio para dentro de 50 minutos titulado "Pausa — protocolo concentracion".
                    4) Despidete brevemente deseando buen trabajo.""")
    );

    /** "protocolo X" at the start of the request ("NOVA, protocolo inicio de turno"). */
    private static final Pattern INVOKE_START = Pattern.compile(
            "^(?:(?:hey|oye|ok)\\s+)?(?:nova\\s+)?(?:(?:activa|activar|ejecuta|ejecutar|inicia|iniciar|lanza|lanzar|aplica|aplicar)\\s+(?:el\\s+)?)?protocolo\\s+(?:de\\s+)?(.+)$");
    /** "...activa el protocolo X" anywhere — needs an explicit verb so questions about protocols don't trigger one. */
    private static final Pattern INVOKE_VERB = Pattern.compile(
            "\\b(?:activa|activar|ejecuta|ejecutar|inicia|iniciar|lanza|lanzar|aplica|aplicar)\\s+(?:el\\s+)?protocolo\\s+(?:de\\s+)?(.+)$");
    private static final Pattern LIST = Pattern.compile("\\bprotocolos\\b");

    private final ProtocolRepository repository;
    private final UserRepository userRepository;

    // ---------- CRUD ----------

    @Transactional(readOnly = true)
    public List<ProtocolResponse> list(UUID userId) {
        List<Protocol> own = repository.findByUser_IdOrderByNameAsc(userId);
        List<ProtocolResponse> out = new ArrayList<>();
        for (BuiltIn b : BUILT_INS) {
            boolean overridden = own.stream().anyMatch(p -> norm(p.getName()).equals(norm(b.name())));
            if (!overridden) out.add(new ProtocolResponse(null, b.name(), b.steps(), true));
        }
        own.forEach(p -> out.add(ProtocolResponse.from(p)));
        return out;
    }

    @Transactional
    public ProtocolResponse create(UUID userId, ProtocolRequest req) {
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("Usuario no encontrado"));
        Protocol p = Protocol.builder().user(user).name(req.name().trim()).steps(req.steps().trim()).build();
        return ProtocolResponse.from(repository.save(p));
    }

    @Transactional
    public ProtocolResponse update(UUID userId, UUID id, ProtocolRequest req) {
        Protocol p = repository.findByIdAndUser_Id(id, userId).orElseThrow(() -> ApiException.notFound("Protocolo no encontrado"));
        p.setName(req.name().trim());
        p.setSteps(req.steps().trim());
        return ProtocolResponse.from(repository.save(p));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        Protocol p = repository.findByIdAndUser_Id(id, userId).orElseThrow(() -> ApiException.notFound("Protocolo no encontrado"));
        repository.delete(p);
    }

    // ---------- Invocation ----------

    /**
     * If the message invokes a protocol, returns the instructions the agent should run instead of the raw text.
     * Empty when the message isn't about protocols.
     */
    @Transactional(readOnly = true)
    public Optional<String> expand(UUID userId, String userText) {
        if (userText == null || userText.isBlank()) return Optional.empty();
        String text = norm(userText);
        Map<String, String> available = available(userId);

        Matcher m = INVOKE_START.matcher(text);
        boolean invoked = m.find();
        if (!invoked) {
            m = INVOKE_VERB.matcher(text);
            invoked = m.find();
        }
        if (invoked) {
            String wanted = cleanName(m.group(1));
            if (wanted.length() >= 3) {
                Optional<Map.Entry<String, String>> hit = match(userId, wanted, available);
                if (hit.isPresent()) {
                    String name = hit.get().getKey();
                    return Optional.of("""
                            [PROTOCOLO "%s" ACTIVADO]
                            Ejecuta ahora estos pasos con tus herramientas, sin pedir confirmacion:
                            %s
                            Al terminar, entrega un parte breve pensado para ser escuchado (frases cortas, sin tablas ni markdown pesado), empezando por "Protocolo %s completado."
                            Peticion original del usuario: "%s"
                            """.formatted(name, hit.get().getValue(), name, userText.trim()));
                }
                return Optional.of("""
                        El usuario pidio el protocolo "%s", que no existe. Diselo con naturalidad y menciona los protocolos disponibles: %s.
                        Sugierele que puede crear protocolos propios en Ajustes → Protocolos.
                        Peticion original del usuario: "%s"
                        """.formatted(wanted, String.join(", ", available.keySet()), userText.trim()));
            }
        }
        if (LIST.matcher(text).find() && (text.contains("cuales") || text.contains("lista") || text.contains("que ")
                || text.contains("tienes") || text.contains("disponibles"))) {
            StringBuilder sb = new StringBuilder("Protocolos disponibles:\n");
            available.forEach((name, steps) -> sb.append("- ").append(name).append('\n'));
            return Optional.of(sb + "\nPresentale al usuario esta lista brevemente y explica que se activan diciendo "
                    + "\"NOVA, protocolo <nombre>\". Peticion original: \"" + userText.trim() + "\"");
        }
        return Optional.empty();
    }

    /** name → steps, user protocols overriding built-ins with the same name. */
    private Map<String, String> available(UUID userId) {
        Map<String, String> out = new LinkedHashMap<>();
        for (BuiltIn b : BUILT_INS) out.put(b.name(), b.steps());
        for (Protocol p : repository.findByUser_IdOrderByNameAsc(userId)) {
            out.keySet().removeIf(k -> norm(k).equals(norm(p.getName())));
            out.put(p.getName(), p.getSteps());
        }
        return out;
    }

    private Optional<Map.Entry<String, String>> match(UUID userId, String wanted, Map<String, String> available) {
        // 1) exact / prefix on names (user protocols included)
        for (Map.Entry<String, String> e : available.entrySet()) {
            String n = norm(e.getKey());
            if (n.equals(wanted) || wanted.startsWith(n) || n.startsWith(wanted)) return Optional.of(e);
        }
        // 2) built-in aliases
        for (BuiltIn b : BUILT_INS) {
            for (String alias : b.aliases()) {
                String a = norm(alias);
                if (a.equals(wanted) || wanted.startsWith(a + " ") || wanted.equals(a)) {
                    String key = available.containsKey(b.name()) ? b.name() : null;
                    if (key != null) return Optional.of(Map.entry(key, available.get(key)));
                }
            }
        }
        // 3) loose containment ("protocolo de inicio de turno por favor")
        for (Map.Entry<String, String> e : available.entrySet()) {
            if (wanted.contains(norm(e.getKey()))) return Optional.of(e);
        }
        return Optional.empty();
    }

    private static String cleanName(String raw) {
        String s = raw == null ? "" : raw;
        s = s.replaceAll("\\b(por favor|porfa|ahora|ya|nova)\\b", " ");
        return s.replaceAll("[^a-z0-9ñ ]", " ").replaceAll("\\s+", " ").trim();
    }

    static String norm(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[¡!¿?,.;:\"]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
