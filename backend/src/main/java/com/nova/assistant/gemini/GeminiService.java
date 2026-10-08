package com.nova.assistant.gemini;

import com.fasterxml.jackson.databind.JsonNode;
import com.nova.assistant.ai.OpenAiProvider;
import com.nova.assistant.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Google Gemini client (free tier, AI Studio key).
 * - Chat/vision through the OpenAI-compatible endpoint (reuses {@link OpenAiProvider}, incl. streaming + tools).
 * - Text-to-speech and multi-speaker dialogue through the Interactions API (returns WAV).
 * - Ephemeral tokens for the browser to open a Gemini Live WebSocket without exposing the API key.
 */
@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);

    /** A speaker turn for multi-speaker TTS. */
    public record Turn(String speaker, String text, String style) { }

    private final AppProperties properties;
    private final RestClient.Builder builder;
    private volatile OpenAiProvider chat;
    private volatile RestClient nativeClient;

    public GeminiService(AppProperties properties, RestClient.Builder builder) {
        this.properties = properties;
        this.builder = builder;
    }

    private AppProperties.Gemini cfg() {
        return properties.getAi().getGemini();
    }

    public boolean available() {
        return cfg().available();
    }

    public boolean ttsAvailable() {
        return available() && cfg().isTts();
    }

    public boolean liveAvailable() {
        return available() && cfg().isLive();
    }

    /** OpenAI-compatible provider pointed at Gemini; null when no key is configured. */
    public OpenAiProvider chat() {
        if (!available()) return null;
        OpenAiProvider p = chat;
        if (p == null) {
            synchronized (this) {
                if (chat == null) {
                    SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
                    rf.setConnectTimeout(5_000);
                    rf.setReadTimeout(120_000);
                    chat = new OpenAiProvider(builder.clone().requestFactory(rf),
                            cfg().getBaseUrl() + "/openai", cfg().getApiKey(), cfg().getChatModel());
                }
                p = chat;
            }
        }
        return p;
    }

    private RestClient nativeClient() {
        RestClient c = nativeClient;
        if (c == null) {
            synchronized (this) {
                if (nativeClient == null) {
                    SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
                    rf.setConnectTimeout(5_000);
                    rf.setReadTimeout(240_000); // audio overviews can take a while
                    nativeClient = builder.clone().requestFactory(rf)
                            .baseUrl(cfg().getBaseUrl())
                            .defaultHeader("x-goog-api-key", cfg().getApiKey())
                            .build();
                }
                c = nativeClient;
            }
        }
        return c;
    }

    // ------------------------------------------------------------------ TTS

    /** Single-speaker speech. Returns a complete WAV file (24 kHz mono 16-bit). */
    public byte[] speak(String text, String voice, String style) {
        Map<String, Object> textPart = new LinkedHashMap<>();
        textPart.put("type", "text");
        textPart.put("text", text);
        if (style != null && !style.isBlank()) {
            textPart.put("annotations", List.of(Map.of("type", "speech_metadata", "style", style)));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", cfg().getTtsModel());
        body.put("input", List.of(Map.of("type", "user_input", "content", List.of(textPart))));
        body.put("response_format", Map.of("type", "audio"));
        body.put("generation_config", Map.of("speech_config", List.of(Map.of("voice", voice))));
        return audioFrom(postInteraction(body));
    }

    /** Two-speaker dialogue (podcast style). speakers: name → prebuilt voice. Returns WAV. */
    public byte[] dialogue(List<Turn> turns, Map<String, String> speakers) {
        List<Map<String, Object>> content = new ArrayList<>();
        for (Turn t : turns) {
            Map<String, Object> ann = new LinkedHashMap<>();
            ann.put("type", "speech_metadata");
            ann.put("speaker", t.speaker());
            if (t.style() != null && !t.style().isBlank()) ann.put("style", t.style());
            Map<String, Object> part = new LinkedHashMap<>();
            part.put("type", "text");
            part.put("text", t.text());
            part.put("annotations", List.of(ann));
            content.add(part);
        }
        List<Map<String, String>> spk = new ArrayList<>();
        speakers.forEach((name, voice) -> spk.add(Map.of("speaker", name, "voice", voice)));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", cfg().getPodcastTtsModel());
        body.put("input", List.of(Map.of("type", "user_input", "content", content)));
        body.put("response_format", Map.of("type", "audio"));
        body.put("generation_config", Map.of("speech_config", Map.of("mode", "conversational", "speakers", spk)));
        return audioFrom(postInteraction(body));
    }

    private JsonNode postInteraction(Map<String, Object> body) {
        return nativeClient().post().uri("/interactions")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class);
    }

    private byte[] audioFrom(JsonNode res) {
        String data = null;
        if (res != null) {
            for (JsonNode step : res.path("steps")) {
                for (JsonNode c : step.path("content")) {
                    if ("audio".equals(c.path("type").asText()) && c.hasNonNull("data")) data = c.get("data").asText();
                }
            }
            // Older response shape (generateContent): candidates[].content.parts[].inlineData.data
            if (data == null) {
                for (JsonNode cand : res.path("candidates")) {
                    for (JsonNode part : cand.path("content").path("parts")) {
                        if (part.path("inlineData").hasNonNull("data")) data = part.path("inlineData").get("data").asText();
                    }
                }
            }
        }
        if (data == null || data.isBlank()) throw new IllegalStateException("Gemini TTS no devolvio audio");
        byte[] bytes = Base64.getDecoder().decode(data);
        return isWav(bytes) ? bytes : wrapPcm(bytes, 24_000);
    }

    private static boolean isWav(byte[] b) {
        return b.length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F';
    }

    /** Adds a RIFF header to raw 16-bit mono PCM. */
    static byte[] wrapPcm(byte[] pcm, int rate) {
        int byteRate = rate * 2;
        byte[] out = new byte[44 + pcm.length];
        java.nio.ByteBuffer bb = java.nio.ByteBuffer.wrap(out).order(java.nio.ByteOrder.LITTLE_ENDIAN);
        bb.put(new byte[]{'R', 'I', 'F', 'F'}).putInt(36 + pcm.length).put(new byte[]{'W', 'A', 'V', 'E'});
        bb.put(new byte[]{'f', 'm', 't', ' '}).putInt(16).putShort((short) 1).putShort((short) 1)
          .putInt(rate).putInt(byteRate).putShort((short) 2).putShort((short) 16);
        bb.put(new byte[]{'d', 'a', 't', 'a'}).putInt(pcm.length).put(pcm);
        return out;
    }

    // ------------------------------------------------------------------ Live

    /**
     * Ephemeral token for one Gemini Live session (browser → Google directly, key stays on the server).
     * Locks only the model; the browser sends the full setup (persona, tools, voice) itself.
     */
    public String liveToken() {
        Instant now = Instant.now();
        Map<String, Object> body = new HashMap<>();
        body.put("uses", 1);
        body.put("expireTime", now.plus(30, ChronoUnit.MINUTES).truncatedTo(ChronoUnit.SECONDS).toString());
        body.put("newSessionExpireTime", now.plus(2, ChronoUnit.MINUTES).truncatedTo(ChronoUnit.SECONDS).toString());
        body.put("liveConnectConstraints", Map.of("model", "models/" + cfg().getLiveModel()));
        JsonNode res = nativeClient().post().uri("/auth_tokens")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class);
        String name = res == null ? null : res.path("name").asText(null);
        if (name == null || name.isBlank()) {
            log.warn("Gemini auth_tokens returned no token: {}", res);
            throw new IllegalStateException("Gemini no devolvio un token de sesion");
        }
        return name;
    }

    public String liveModel() {
        return cfg().getLiveModel();
    }
}
