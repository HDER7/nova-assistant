package com.nova.assistant.ai;

import com.nova.assistant.ai.dto.ChatRequest;
import com.nova.assistant.ai.dto.ChatResponse;
import com.nova.assistant.config.AppProperties;
import com.nova.assistant.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final AiService aiService;
    private final AppProperties properties;

    @PostMapping
    public ChatResponse chat(@AuthenticationPrincipal SecurityUser principal, @Valid @RequestBody ChatRequest req) {
        return aiService.chat(principal.getId(), req);
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal SecurityUser principal, @Valid @RequestBody ChatRequest req) {
        return aiService.stream(principal.getId(), req);
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return aiService.status();
    }

    @GetMapping("/models")
    public Map<String, Object> models() {
        List<Map<String, String>> models = new ArrayList<>(List.of(
                Map.of("id", "auto", "label", "Auto (rápido ↔ potente)"),
                Map.of("id", "llama-3.3-70b-versatile", "label", "Llama 3.3 70B (potente)"),
                Map.of("id", "llama-3.1-8b-instant", "label", "Llama 3.1 8B (rápido)"),
                Map.of("id", "openai/gpt-oss-120b", "label", "GPT-OSS 120B")));
        AppProperties.Local local = properties.getAi().getLocal();
        if (local.isEnabled()) {
            models.add(Map.of("id", "local", "label", local.getLabel() + " · privado/offline"));
        }
        Map<String, Object> out = new HashMap<>();
        out.put("default", properties.getAi().getOpenai().getModel());
        out.put("models", models);
        return out;
    }
}
