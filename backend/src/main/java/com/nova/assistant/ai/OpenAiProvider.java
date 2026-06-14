package com.nova.assistant.ai;

import com.nova.assistant.ai.dto.ChatMessage;
import com.nova.assistant.config.AppProperties;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * OpenAI-compatible Chat Completions provider (OpenAI, Groq, Gemini, Ollama, ...).
 * Supports tool/function calling via {@link #chatRaw}.
 */
public class OpenAiProvider implements AiProvider {

    private final RestClient client;
    private final String model;

    public OpenAiProvider(RestClient.Builder builder, AppProperties.OpenAi cfg) {
        this.model = cfg.getModel();
        this.client = builder
                .baseUrl(cfg.getBaseUrl())
                .defaultHeader("Authorization", "Bearer " + cfg.getApiKey())
                .build();
    }

    @Override
    public String name() {
        return "openai:" + model;
    }

    @Override
    public boolean live() {
        return true;
    }

    @Override
    public String complete(List<ChatMessage> messages, double temperature, int maxTokens) {
        List<Map<String, Object>> msgs = messages.stream().map(m -> {
            Map<String, Object> x = new HashMap<>();
            x.put("role", m.role());
            x.put("content", m.content());
            return x;
        }).toList();
        Map<String, Object> message = chatRaw(msgs, null, temperature, maxTokens);
        Object content = message.get("content");
        return content == null ? "" : content.toString().trim();
    }

    /**
     * Full chat completion that returns the raw assistant message (choices[0].message),
     * which may contain "tool_calls". Pass a non-null tools list to enable function calling.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> chatRaw(List<Map<String, Object>> messages,
                                       List<Map<String, Object>> tools,
                                       double temperature, int maxTokens) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);
        body.put("messages", messages);
        if (tools != null && !tools.isEmpty()) {
            body.put("tools", tools);
            body.put("tool_choice", "auto");
        }
        Map<String, Object> response = client.post()
                .uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(Map.class);
        if (response == null || response.get("choices") == null) {
            throw new IllegalStateException("Respuesta vacia del proveedor de IA");
        }
        List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
        return (Map<String, Object>) choices.get(0).get("message");
    }
}
