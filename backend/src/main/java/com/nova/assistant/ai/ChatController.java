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
        List<Map<String, String>> models = new ArrayList<>();
        models.add(Map.of("id", "auto", "label", "Auto (rápido ↔ potente)"));
        // Catalog comes from config (NOVA_AI_MODELS_CATALOG) so retired provider models can be swapped without code changes.
        for (String entry : properties.getAi().getModels().getCatalog().split(",")) {
            String e = entry.trim();
            if (e.isEmpty()) continue;
            int bar = e.indexOf('|');
            String id = bar > 0 ? e.substring(0, bar).trim() : e;
            String label = bar > 0 ? e.substring(bar + 1).trim() : e;
            if (!id.isEmpty()) models.add(Map.of("id", id, "label", label));
        }
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
