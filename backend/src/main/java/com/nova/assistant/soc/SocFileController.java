package com.nova.assistant.soc;

import com.nova.assistant.common.ApiException;
import com.nova.assistant.document.DocumentAnalysisService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/soc")
@RequiredArgsConstructor
public class SocFileController {

    private static final int MAX_CHARS = 12000;

    private final DocumentAnalysisService documentAnalysisService;
    private final SocService socService;
    private final SocAiService socAiService;
    private final ReportService reportService;

    @PostMapping(value = "/analyze-file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SocFileResult analyzeFile(@RequestParam("file") MultipartFile file) {
        String text = documentAnalysisService.extractPlainText(file);
        if (text == null || text.isBlank()) {
            throw ApiException.badRequest("No se pudo extraer texto del archivo.");
        }
        String truncated = text.length() > MAX_CHARS ? text.substring(0, MAX_CHARS) : text;
        IocResult iocs = socService.extractIocs(text);
        String triage = socAiService.triage(truncated).analysis();
        return new SocFileResult(file.getOriginalFilename(), text.length(), iocs, triage);
    }

    @PostMapping("/report")
    public ResponseEntity<byte[]> report(@Valid @RequestBody ReportRequest req) {
        byte[] pdf = reportService.generatePdf(req.title(), req.content());
        String base = (req.title() == null || req.title().isBlank()) ? "informe-nova" : req.title();
        String name = base.replaceAll("[^A-Za-z0-9._-]", "_") + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
                .body(pdf);
    }
}
