package com.nova.assistant.ai;

import com.nova.assistant.ai.dto.ChatRequest;
import com.nova.assistant.ai.dto.ChatResponse;
import com.nova.assistant.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final AiService aiService;

    @PostMapping
    public ChatResponse chat(@AuthenticationPrincipal SecurityUser principal,
                             @Valid @RequestBody ChatRequest req) {
        return aiService.chat(principal.getId(), req);
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal SecurityUser principal,
                             @Valid @RequestBody ChatRequest req) {
        return aiService.stream(principal.getId(), req);
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return aiService.status();
    }
}
