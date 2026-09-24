package com.nova.assistant.ai;

import com.nova.assistant.ai.dto.ChatMessage;
import com.nova.assistant.ai.dto.ChatRequest;
import com.nova.assistant.ai.dto.ChatResponse;
import com.nova.assistant.ai.dto.ProviderContext;
import com.nova.assistant.config.AppProperties;
import com.nova.assistant.conversation.dto.MessageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
@RequiredArgsConstructor
public class AiService {

    private static final int MAX_TOOL_ITERATIONS = 5;

    private final AiProvider provider;
    private final MockAiProvider fallback;
    private final AiPersistence persistence;
    private final AppProperties properties;
    private final ToolService toolService;
    private final RestClient.Builder restClientBuilder;

    /** Lazily-built local engine (OpenJarvis/Ollama), created on first use from config. */
    private volatile OpenAiProvider localEngine;

    /** A resolved inference target: which OpenAI-compatible engine + which model id. */
    private record Engine(OpenAiProvider openAi, String model, boolean local) {}

    private OpenAiProvider local() {
        OpenAiProvider e = localEngine;
        if (e == null) {
            AppProperties.Local l = properties.getAi().getLocal();
            org.springframework.http.client.SimpleClientHttpRequestFactory rf =
                    new org.springframework.http.client.SimpleClientHttpRequestFactory();
            rf.setConnectTimeout(2_000);   // fail fast when OpenJarvis/Ollama isn't running
            rf.setReadTimeout(120_000);    // local models can be slow to answer
            e = new OpenAiProvider(restClientBuilder.clone().requestFactory(rf),
                    l.getBaseUrl(), l.getApiKey(), l.getModel());
            localEngine = e;
        }
        return e;
    }

    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "nova-sse");
        t.setDaemon(true);
        return t;
    });

    public ChatResponse chat(UUID userId, ChatRequest req) {
        String message = req.message().trim();
        ProviderContext ctx = persistence.prepareUserTurn(userId, req.conversationId(), message);
        String answer = generateAgentic(userId, ctx.messages(), resolveEngine(req.model(), message));
        MessageResponse mr = persistence.finishAssistantTurn(userId, ctx.conversationId(), answer, message);
        return new ChatResponse(ctx.conversationId(), mr);
    }

    public SseEmitter stream(UUID userId, ChatRequest req) {
        SseEmitter emitter = new SseEmitter(180_000L);
        String message = req.message().trim();
        Engine engine = resolveEngine(req.model(), message);
        executor.execute(() -> {
            try {
                ProviderContext ctx = persistence.prepareUserTurn(userId, req.conversationId(), message);
                emitter.send(SseEmitter.event().name("meta")
                        .data(Map.of("conversationId", ctx.conversationId().toString()), MediaType.APPLICATION_JSON));
                String answer = generateAgentic(userId, ctx.messages(), engine);
                for (String token : tokenize(answer)) {
                    emitter.send(SseEmitter.event().name("token").data(Map.of("t", token), MediaType.APPLICATION_JSON));
                    Thread.sleep(14);
                }
                MessageResponse mr = persistence.finishAssistantTurn(userId, ctx.conversationId(), answer, message);
                emitter.send(SseEmitter.event().name("done").data(mr, MediaType.APPLICATION_JSON));
                emitter.complete();
            } catch (Exception ex) {
                try { emitter.completeWithError(ex); } catch (Exception ignored) { }
            }
        });
        return emitter;
    }

    public String oneShot(String systemPrompt, String userContent) {
        return generate(List.of(new ChatMessage("system", systemPrompt), new ChatMessage("user", userContent)));
    }

    public Map<String, Object> status() {
        AppProperties.Local local = properties.getAi().getLocal();
        Map<String, Object> localInfo = new HashMap<>();
        localInfo.put("enabled", local.isEnabled());
        localInfo.put("label", local.getLabel());
        localInfo.put("baseUrl", local.getBaseUrl());
        localInfo.put("reachable", local.isEnabled() && local().reachable());
        Map<String, Object> out = new HashMap<>();
        out.put("provider", provider.name());
        out.put("live", provider.live());
        out.put("model", properties.getAi().getOpenai().getModel());
        out.put("local", localInfo);
        return out;
    }

    /** Chooses which engine (cloud primary vs. local OpenJarvis) and model id to use for this request. */
    private Engine resolveEngine(String requested, String message) {
        String r = requested == null ? "" : requested.trim();
        boolean wantsLocal = r.equalsIgnoreCase("local")
                || r.equalsIgnoreCase("openjarvis")
                || r.toLowerCase().startsWith("local:");
        if (wantsLocal && properties.getAi().getLocal().isEnabled()) {
            String sub = r.contains(":") ? r.substring(r.indexOf(':') + 1).trim() : "";
            String model = (sub.isBlank() || sub.equalsIgnoreCase("auto"))
                    ? (local().defaultModel().isBlank() ? null : local().defaultModel())
                    : sub;
            return new Engine(local(), model, true);
        }
        OpenAiProvider cloud = (provider instanceof OpenAiProvider o) ? o : null;
        return new Engine(cloud, resolveModel(requested, message), false);
    }

    /** Resolves the model to use: a specific id, "auto" (fast↔strong by complexity), or default (null). */
    private String resolveModel(String requested, String message) {
        if (requested == null || requested.isBlank()) return null;
        if (!requested.equalsIgnoreCase("auto")) return requested;
        String m = message == null ? "" : message.toLowerCase();
        boolean complex = message != null && message.length() > 480;
        for (String k : new String[]{"código", "codigo", "refactor", "algoritmo", "script", "analiza", "depura",
                "explica en detalle", "test", "prueba unitaria", "arquitectura", "optimiza", "vulnerab"}) {
            if (m.contains(k)) { complex = true; break; }
        }
        AppProperties.Models mc = properties.getAi().getModels();
        return complex ? mc.getStrong() : mc.getFast();
    }

    private String generate(List<ChatMessage> messages) {
        double temperature = properties.getAi().getOpenai().getTemperature();
        int maxTokens = properties.getAi().getOpenai().getMaxTokens();
        try { return provider.complete(messages, temperature, maxTokens); }
        catch (Exception e) { return fallback.complete(messages, temperature, maxTokens); }
    }

    private String generateAgentic(UUID userId, List<ChatMessage> baseMessages, Engine engine) {
        double temperature = properties.getAi().getOpenai().getTemperature();
        int maxTokens = properties.getAi().getOpenai().getMaxTokens();
        String model = engine.model();
        OpenAiProvider openAi = engine.openAi();

        if (openAi == null) {
            try { return provider.complete(baseMessages, temperature, maxTokens); }
            catch (Exception e) { return fallback.complete(baseMessages, temperature, maxTokens); }
        }
        try {
            return runAgentic(userId, baseMessages, openAi, model, temperature, maxTokens);
        } catch (Exception first) {
            if (engine.local()) {
                return "No consigo contactar con el motor local en " + properties.getAi().getLocal().getBaseUrl()
                        + ". Comprueba que OpenJarvis (`jarvis serve`) u Ollama esté en marcha, o elige un modelo en la nube.";
            }
            if (model != null) {
                // The chosen model may have been retired by the provider: retry once with the default model.
                try { return runAgentic(userId, baseMessages, openAi, null, temperature, maxTokens); }
                catch (Exception ignored) { /* fall through to the offline brain */ }
            }
            return fallback.complete(baseMessages, temperature, maxTokens);
        }
    }

    private String runAgentic(UUID userId, List<ChatMessage> baseMessages, OpenAiProvider openAi, String model,
                              double temperature, int maxTokens) {
        {
            List<Map<String, Object>> msgs = new ArrayList<>();
            for (ChatMessage m : baseMessages) {
                Map<String, Object> mm = new HashMap<>();
                mm.put("role", m.role());
                mm.put("content", m.content());
                msgs.add(mm);
            }
            List<Map<String, Object>> tools = toolService.toolSpecs();
            for (int iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
                Map<String, Object> assistant = openAi.chatRaw(msgs, tools, temperature, maxTokens, model);
                Object toolCalls = assistant.get("tool_calls");
                if (!(toolCalls instanceof List<?> calls) || calls.isEmpty()) {
                    Object content = assistant.get("content");
                    return content == null ? "" : content.toString().trim();
                }
                msgs.add(assistant);
                for (Object o : calls) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> call = (Map<String, Object>) o;
                    String id = String.valueOf(call.get("id"));
                    @SuppressWarnings("unchecked")
                    Map<String, Object> function = (Map<String, Object>) call.get("function");
                    String fname = function == null ? null : String.valueOf(function.get("name"));
                    String fargs = function == null ? null : String.valueOf(function.get("arguments"));
                    String result = toolService.execute(userId, fname, fargs);
                    Map<String, Object> toolMsg = new HashMap<>();
                    toolMsg.put("role", "tool");
                    toolMsg.put("tool_call_id", id);
                    toolMsg.put("content", result);
                    msgs.add(toolMsg);
                }
            }
            Map<String, Object> finalMsg = openAi.chatRaw(msgs, null, temperature, maxTokens, model);
            Object content = finalMsg.get("content");
            return content == null ? "" : content.toString().trim();
        }
    }

    private List<String> tokenize(String text) {
        List<String> out = new ArrayList<>();
        if (text == null || text.isEmpty()) return out;
        String[] words = text.split(" ");
        for (int i = 0; i < words.length; i++) out.add(i == words.length - 1 ? words[i] : words[i] + " ");
        return out;
    }
}
