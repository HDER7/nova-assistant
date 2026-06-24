package com.nova.assistant.voice;

import com.nova.assistant.common.ApiException;
import com.nova.assistant.config.AppProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Speech-to-text via an OpenAI-compatible audio endpoint (Groq whisper-large-v3 by default).
 * Far more accurate than the browser's Web Speech API, especially for Spanish.
 */
@Service
@RequiredArgsConstructor
public class TranscriptionService {

    private static final String MODEL = "whisper-large-v3";

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
            builder.part("model", MODEL);
            if (language != null && !language.isBlank()) {
                builder.part("language", language);
            }
            builder.part("response_format", "json");

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

            Object text = response == null ? null : response.get("text");
            return text == null ? "" : text.toString().trim();
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw ApiException.badRequest("No se pudo transcribir el audio: " + e.getMessage());
        }
    }
}
