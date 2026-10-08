package com.nova.assistant.voice;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/voice")
@RequiredArgsConstructor
public class VoiceController {

    private final TranscriptionService transcriptionService;
    private final SpeechService speechService;

    public record SpeakRequest(@jakarta.validation.constraints.NotBlank String text, String persona) { }

    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> transcribe(@RequestParam("file") MultipartFile file,
                                          @RequestParam(value = "language", required = false, defaultValue = "es") String language) {
        return Map.of("text", transcriptionService.transcribe(file, language));
    }

    /** Neural voice (Gemini TTS) for one chunk of NOVA's answer. Returns audio/wav. */
    @PostMapping("/speak")
    public org.springframework.http.ResponseEntity<byte[]> speak(@jakarta.validation.Valid @RequestBody SpeakRequest req) {
        byte[] wav = speechService.speak(req.text(), req.persona());
        return org.springframework.http.ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("audio/wav"))
                .header("Cache-Control", "private, max-age=3600")
                .body(wav);
    }
}
