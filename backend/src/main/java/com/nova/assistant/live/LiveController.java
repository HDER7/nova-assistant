package com.nova.assistant.live;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nova.assistant.ai.AiPersistence;
import com.nova.assistant.ai.ToolService;
import com.nova.assistant.common.ApiException;
import com.nova.assistant.gemini.GeminiService;
import com.nova.assistant.security.SecurityUser;
import com.nova.assistant.voice.SpeechService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Gemini Live (real-time voice) for the HUD. The browser talks to Google directly over a WebSocket using a
 * short-lived token minted here, so the API key never leaves the server. Tool calls made by the live model
 * are executed by NOVA's backend through {@code /api/live/tool}.
 */
@RestController
@RequestMapping("/api/live")
@RequiredArgsConstructor
public class LiveController {

    private static final Logger log = LoggerFactory.getLogger(LiveController.class);
    private static final String WS =
            "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

    private final GeminiService gemini;
    private final AiPersistence persistence;
    private final ToolService toolService;
    private final ObjectMapper mapper;

    public record ToolRequest(@NotBlank String name, Map<String, Object> args, String id) { }

    @PostMapping("/session")
    public Map<String, Object> session(@AuthenticationPrincipal SecurityUser p) {
        if (!gemini.liveAvailable()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Gemini Live no está configurado (NOVA_AI_GEMINI_API_KEY).");
        }
        String token;
        try {
            token = gemini.liveToken();
        } catch (RestClientResponseException e) {
            String body = e.getResponseBodyAsString();
            log.warn("Live token failed HTTP {}: {}", e.getStatusCode().value(), body.length() > 300 ? body.substring(0, 300) : body);
            throw new ApiException(e.getStatusCode().value() == 429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_GATEWAY,
                    "No se pudo abrir una sesión de Gemini Live.");
        }

        List<Map<String, Object>> decls = new ArrayList<>();
        for (Map<String, Object> spec : toolService.toolSpecs()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> fn = (Map<String, Object>) spec.get("function");
            if (fn == null) continue;
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("name", fn.get("name"));
            d.put("description", fn.get("description"));
            d.put("parameters", fn.get("parameters"));
            decls.add(d);
        }

        String persona = persistence.personaOf(p.getId());
        Map<String, Object> setup = new LinkedHashMap<>();
        setup.put("model", "models/" + gemini.liveModel());
        setup.put("responseModalities", List.of("AUDIO"));
        setup.put("systemInstruction", Map.of("parts", List.of(Map.of("text", persistence.liveSystemPrompt(p.getId())))));
        setup.put("tools", List.of(Map.of("functionDeclarations", decls)));
        setup.put("speechConfig", Map.of("voiceConfig", Map.of("prebuiltVoiceConfig", Map.of("voiceName", SpeechService.voiceFor(persona)))));
        setup.put("inputAudioTranscription", Map.of());
        setup.put("outputAudioTranscription", Map.of());

        Map<String, Object> out = new HashMap<>();
        out.put("url", WS + "?access_token=" + java.net.URLEncoder.encode(token, java.nio.charset.StandardCharsets.UTF_8));
        out.put("setup", Map.of("setup", setup));
        out.put("persona", persona);
        return out;
    }

    /** Executes a tool requested by the live model and returns its result plus a HUD card. */
    @PostMapping("/tool")
    public Map<String, Object> tool(@AuthenticationPrincipal SecurityUser p, @Valid @RequestBody ToolRequest req) throws Exception {
        String args = mapper.writeValueAsString(req.args() == null ? Map.of() : req.args());
        String result = toolService.execute(p.getId(), req.name(), args);
        Map<String, Object> out = new HashMap<>();
        out.put("result", result);
        out.put("card", toolService.card(req.id(), req.name(), args, result));
        return out;
    }
}
