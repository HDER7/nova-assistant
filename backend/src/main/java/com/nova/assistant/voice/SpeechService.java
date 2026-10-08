package com.nova.assistant.voice;

import com.nova.assistant.common.ApiException;
import com.nova.assistant.gemini.GeminiService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * NOVA's neural voice (Gemini TTS). Each personality has its own prebuilt voice and delivery style.
 * A small LRU cache avoids spending free-tier quota on repeated phrases (greetings, protocol openers).
 */
@Service
@RequiredArgsConstructor
public class SpeechService {

    private static final Logger log = LoggerFactory.getLogger(SpeechService.class);
    private static final int MAX_CHARS = 1200;
    private static final int CACHE_SIZE = 80;

    private record Voice(String name, String style) { }

    private static final Map<String, Voice> VOICES = Map.of(
            "JARVIS", new Voice("Charon", "sereno, culto y elegante, como un mayordomo británico; ritmo pausado y seguro, con un leve toque irónico"),
            "FRIDAY", new Voice("Aoede", "cercana, cálida y desenfadada; energía alegre y ritmo ágil, como una amiga de confianza"),
            "EDITH", new Voice("Kore", "sistema táctico: firme, precisa y rápida; tono neutro y concentrado, sin adornos"));

    private final GeminiService gemini;

    private final Map<String, byte[]> cache = new LinkedHashMap<>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, byte[]> eldest) {
            return size() > CACHE_SIZE;
        }
    };

    /** Prebuilt Gemini voice for a personality (shared with Gemini Live). */
    public static String voiceFor(String persona) {
        return VOICES.getOrDefault(persona == null ? "" : persona.toUpperCase(Locale.ROOT), VOICES.get("JARVIS")).name();
    }

    public boolean available() {
        return gemini.ttsAvailable();
    }

    public byte[] speak(String text, String persona) {
        if (!available()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Voz neuronal no configurada");
        }
        String clean = text == null ? "" : text.trim();
        if (clean.isEmpty()) throw ApiException.badRequest("Texto vacío");
        if (clean.length() > MAX_CHARS) clean = clean.substring(0, MAX_CHARS);
        Voice v = VOICES.getOrDefault(persona == null ? "" : persona.toUpperCase(Locale.ROOT), VOICES.get("JARVIS"));
        String key = v.name() + "|" + clean;
        synchronized (cache) {
            byte[] hit = cache.get(key);
            if (hit != null) return hit;
        }
        try {
            byte[] wav = gemini.speak(clean, v.name(), v.style());
            synchronized (cache) {
                cache.put(key, wav);
            }
            return wav;
        } catch (RestClientResponseException e) {
            int s = e.getStatusCode().value();
            String body = e.getResponseBodyAsString();
            log.warn("Gemini TTS failed HTTP {}: {}", s, body.length() > 300 ? body.substring(0, 300) : body);
            // 429 → the browser falls back to its own voice for a while.
            throw new ApiException(s == 429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_GATEWAY, "Voz neuronal no disponible");
        } catch (Exception e) {
            log.warn("Gemini TTS failed: {}", e.toString());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Voz neuronal no disponible");
        }
    }
}
