package com.nova.assistant.voice;

import com.nova.assistant.common.ApiException;
import com.nova.assistant.config.AppProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Speech-to-text via an OpenAI-compatible audio endpoint (Groq whisper-large-v3 by default).
 * Far more accurate than the browser's Web Speech API, especially for Spanish.
 */
@Service
@RequiredArgsConstructor
public class TranscriptionService {

    /** Probability above which Whisper itself thinks a segment contains no speech. */
    private static final double NO_SPEECH_MAX = 0.6;
    /** Segments with a lower average log-probability are low-confidence guesses. */
    private static final double MIN_AVG_LOGPROB = -1.0;

    /**
     * Phrases Whisper famously "hallucinates" on silence, breathing or background noise
     * (learned from subtitled videos). A transcript made only of these is discarded.
     */
    private static final Set<String> HALLUCINATIONS = Set.of(
            "gracias", "gracias por ver", "gracias por ver el video", "gracias por ver el video.",
            "muchas gracias", "muchas gracias por ver el video", "gracias por su atencion",
            "suscribete", "suscribete al canal", "no olvides suscribirte", "hasta la proxima",
            "subtitulos realizados por la comunidad de amara.org", "subtitulos por la comunidad de amara.org",
            "subtitulado por la comunidad de amara.org", "amara.org",
            "thank you", "thank you for watching", "thanks for watching", "you", "bye", "adios",
            "mmm", "eh", "ah", "oh", "hmm", "...", ".");

    private final AppProperties properties;
    private final RestClient.Builder restClientBuilder;

    public String transcribe(MultipartFile file, String language) {
        AppProperties.OpenAi cfg = properties.getAi().getOpenai();
        if (cfg.getApiKey() == null || cfg.getApiKey().isBlank()) {
            throw ApiException.badRequest("Transcripcion no disponible: configura una clave de IA (Groq/OpenAI).");
        }
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("No se ha recibido audio.");
        }
        try {
            MultipartBodyBuilder builder = new MultipartBodyBuilder();
            builder.part("file", file.getResource());
            builder.part("model", properties.getAi().getModels().getWhisper());
            if (language != null && !language.isBlank()) {
                builder.part("language", language);
            }
            builder.part("response_format", "verbose_json");

            RestClient client = restClientBuilder
                    .baseUrl(cfg.getBaseUrl())
                    .defaultHeader("Authorization", "Bearer " + cfg.getApiKey())
                    .build();

            @SuppressWarnings("unchecked")
            Map<String, Object> response = client.post()
                    .uri("/audio/transcriptions")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(builder.build())
                    .retrieve()
                    .body(Map.class);

            return clean(response);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw ApiException.badRequest("No se pudo transcribir el audio: " + e.getMessage());
        }
    }

    /** Keeps only confident speech segments and drops known Whisper hallucinations. */
    @SuppressWarnings("unchecked")
    private String clean(Map<String, Object> response) {
        if (response == null) return "";
        String text;
        Object segs = response.get("segments");
        if (segs instanceof List<?> list && !list.isEmpty()) {
            StringBuilder sb = new StringBuilder();
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) continue;
                Map<String, Object> seg = (Map<String, Object>) m;
                double noSpeech = num(seg.get("no_speech_prob"), 0.0);
                double logprob = num(seg.get("avg_logprob"), 0.0);
                if (noSpeech > NO_SPEECH_MAX || logprob < MIN_AVG_LOGPROB) continue;
                Object t = seg.get("text");
                if (t != null) sb.append(t.toString().trim()).append(' ');
            }
            text = sb.toString().trim();
        } else {
            Object t = response.get("text");
            text = t == null ? "" : t.toString().trim();
        }
        return isHallucination(text) ? "" : text;
    }

    private boolean isHallucination(String text) {
        if (text == null || text.isBlank()) return true;
        String n = Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[¡!¿?,;:\"]", "")
                .replaceAll("\\s+", " ")
                .trim();
        String noDot = n.endsWith(".") ? n.substring(0, n.length() - 1).trim() : n;
        return n.length() < 2 || HALLUCINATIONS.contains(n) || HALLUCINATIONS.contains(noDot);
    }

    private double num(Object o, double def) {
        if (o instanceof Number x) return x.doubleValue();
        try { return o == null ? def : Double.parseDouble(o.toString()); } catch (Exception e) { return def; }
    }
}
