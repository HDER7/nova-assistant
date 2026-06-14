package com.nova.assistant.document;

import com.nova.assistant.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentAnalysisService documentAnalysisService;

    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentAnalysisResponse analyze(@AuthenticationPrincipal SecurityUser principal,
                                            @RequestParam("file") MultipartFile file,
                                            @RequestParam(value = "prompt", required = false) String prompt) {
        return documentAnalysisService.analyze(file, prompt);
    }
}
