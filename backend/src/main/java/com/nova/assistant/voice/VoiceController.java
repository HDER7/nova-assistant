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

    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> transcribe(@RequestParam("file") MultipartFile file,
                                          @RequestParam(value = "language", required = false, defaultValue = "es") String language) {
        return Map.of("text", transcriptionService.transcribe(file, language));
    }
}
