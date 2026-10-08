package com.nova.assistant.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nova.assistant.ai.dto.ChatMessage;
import com.nova.assistant.config.AppProperties;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Consumer;

/**
 * OpenAI-compatible provider (OpenAI, Groq, OpenJarvis, Ollama, ...) with tool calling,
 * per-request model override and real token streaming.
 */
public class OpenAiProvider implements AiProvider {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final RestClient client;
    private final String model;

    public OpenAiProvider(RestClient.Builder builder, AppProperties.OpenAi cfg) {
        this(builder, cfg.getBaseUrl(), cfg.getApiKey(), cfg.getModel());
    }

    /** Generic constructor for any OpenAI-compatible endpoint (OpenAI, Groq, OpenJarvis, Ollama, ...). */
    public OpenAiProvider(RestClient.Builder builder, String baseUrl, String apiKey, String model) {
        this.model = model == null ? "" : model;
        this.client = builder.baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer " + (apiKey == null ? "" : apiKey)).build();
    }

    @Override public String name() { return "openai:" + (model.isBlank() ? "auto" : model); }
    @Override public boolean live() { return true; }
    public String defaultModel() { return model; }

    /** Lightweight reachability probe (GET /models). Returns true if the endpoint answers. */
    public boolean reachable() {
        try {
            client.get().uri("/models").retrieve().body(Map.class);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

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

    private Map<String, Object> body(List<Map<String, Object>> messages, List<Map<String, Object>> tools,
                                     double temperature, int maxTokens, String modelOverride) {
        Map<String, Object> body = new HashMap<>();
        String effective = (modelOverride != null && !modelOverride.isBlank()) ? modelOverride : model;
        body.put("model", effective);
        body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);
        if (effective != null && (effective.contains("gpt-oss") || effective.startsWith("gemini-3"))) {
            // Reasoning models spend completion tokens thinking; keep it short so the answer isn't cut off
            // and the voice starts sooner.
            body.put("reasoning_effort", "low");
        }
        body.put("messages", messages);
        if (tools != null && !tools.isEmpty()) {
            body.put("tools", tools);
            body.put("tool_choice", "auto");
        }
        return body;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> chatRaw(List<Map<String, Object>> messages, List<Map<String, Object>> tools,
                                       double temperature, int maxTokens, String modelOverride) {
        Map<String, Object> response = client.post().uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body(messages, tools, temperature, maxTokens, modelOverride))
                .retrieve().body(Map.class);
        if (response == null || response.get("choices") == null) {
            throw new IllegalStateException("Respuesta vacia del proveedor de IA");
        }
        List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
        return (Map<String, Object>) choices.get(0).get("message");
    }

    /**
     * Streaming chat completion. Text deltas are pushed to {@code onToken} as they arrive;
     * tool-call fragments are reassembled. Returns the full assistant message
     * ({@code role}, {@code content}, optional {@code tool_calls}) in the same shape as {@link #chatRaw}.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> chatStream(List<Map<String, Object>> messages, List<Map<String, Object>> tools,
                                          double temperature, int maxTokens, String modelOverride,
                                          Consumer<String> onToken) {
        Map<String, Object> body = body(messages, tools, temperature, maxTokens, modelOverride);
        body.put("stream", true);
        return client.post().uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_JSON)
                .body(body)
                .exchange((request, response) -> {
                    if (response.getStatusCode().isError()) {
                        byte[] err = response.getBody().readAllBytes();
                        throw new RestClientResponseException("AI provider error " + response.getStatusCode().value(),
                                response.getStatusCode(), response.getStatusText(), response.getHeaders(),
                                err, StandardCharsets.UTF_8);
                    }
                    StringBuilder content = new StringBuilder();
                    TreeMap<Integer, Map<String, Object>> calls = new TreeMap<>();
                    try (BufferedReader reader = new BufferedReader(
                            new InputStreamReader(response.getBody(), StandardCharsets.UTF_8))) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            if (!line.startsWith("data:")) continue;
                            String data = line.substring(5).trim();
                            if (data.isEmpty()) continue;
                            if ("[DONE]".equals(data)) break;
                            JsonNode node = MAPPER.readTree(data);
                            if (node.has("error")) {
                                throw new IllegalStateException("Error del proveedor en streaming: " + node.get("error"));
                            }
                            JsonNode choices = node.path("choices");
                            if (!choices.isArray() || choices.isEmpty()) continue;
                            JsonNode delta = choices.get(0).path("delta");

                            JsonNode text = delta.get("content");
                            if (text != null && !text.isNull()) {
                                String t = text.asText();
                                if (!t.isEmpty()) {
                                    content.append(t);
                                    if (onToken != null) onToken.accept(t);
                                }
                            }

                            JsonNode toolCalls = delta.get("tool_calls");
                            if (toolCalls != null && toolCalls.isArray()) {
                                for (JsonNode tc : toolCalls) {
                                    int idx = tc.path("index").asInt(calls.size());
                                    Map<String, Object> acc = calls.computeIfAbsent(idx, k -> {
                                        Map<String, Object> m = new HashMap<>();
                                        Map<String, Object> f = new HashMap<>();
                                        f.put("name", "");
                                        f.put("arguments", "");
                                        m.put("type", "function");
                                        m.put("function", f);
                                        return m;
                                    });
                                    if (tc.hasNonNull("id")) acc.put("id", tc.get("id").asText());
                                    // Gemini 3 attaches a thought signature here; it must be sent back verbatim.
                                    if (tc.has("extra_content")) {
                                        acc.put("extra_content", MAPPER.convertValue(tc.get("extra_content"), Map.class));
                                    }
                                    Map<String, Object> f = (Map<String, Object>) acc.get("function");
                                    JsonNode fn = tc.path("function");
                                    if (fn.hasNonNull("name") && f.get("name").toString().isEmpty()) {
                                        f.put("name", fn.get("name").asText());
                                    }
                                    if (fn.hasNonNull("arguments")) {
                                        f.put("arguments", f.get("arguments") + fn.get("arguments").asText());
                                    }
                                }
                            }
                        }
                    }
                    Map<String, Object> msg = new HashMap<>();
                    msg.put("role", "assistant");
                    msg.put("content", content.toString());
                    if (!calls.isEmpty()) {
                        calls.forEach((idx, call) -> call.putIfAbsent("id", "call_" + idx));
                        msg.put("tool_calls", new ArrayList<>(calls.values()));
                    }
                    return msg;
                });
    }
}
