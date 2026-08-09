package com.nova.assistant.ai;

import com.nova.assistant.ai.dto.ChatMessage;
import com.nova.assistant.config.AppProperties;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** OpenAI-compatible provider (OpenAI, Groq, Gemini, Ollama, ...) with tool calling and per-request model override. */
public class OpenAiProvider implements AiProvider {

    private final RestClient client;
    private final String model;

    public OpenAiProvider(RestClient.Builder builder, AppProperties.OpenAi cfg) {
        this.model = cfg.getModel();
        this.client = builder.baseUrl(cfg.getBaseUrl()).defaultHeader("Authorization", "Bearer " + cfg.getApiKey()).build();
    }

    @Override public String name() { return "openai:" + model; }
    @Override public boolean live() { return true; }
    public String defaultModel() { return model; }

    @Override
    public String complete(List<ChatMessage> messages, double temperature, int maxTokens) {
        List<Map<String, Object>> msgs = messages.stream().map(m -> {
            Map<String, Object> x = new HashMap<>();
            x.put("role", m.role());
            x.put("content", m.content());
            return x;
        }).toList();
        Map<String, Object> message = chatRaw(msgs, null, temperature, maxTokens, null);
        Object content = message.get("content");
        return content == null ? "" : content.toString().trim();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> chatRaw(List<Map<String, Object>> messages, List<Map<String, Object>> tools,
                                       double temperature, int maxTokens, String modelOverride) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", (modelOverride != null && !modelOverride.isBlank()) ? modelOverride : model);
        body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);
        body.put("messages", messages);
        if (tools != null && !tools.isEmpty()) {
            body.put("tools", tools);
            body.put("tool_choice", "auto");
        }
        Map<String, Object> response = client.post().uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(Map.class);
        if (response == null || response.get("choices") == null) {
            throw new IllegalStateException("Respuesta vacia del proveedor de IA");
        }
        List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
        return (Map<String, Object>) choices.get(0).get("message");
    }
}
