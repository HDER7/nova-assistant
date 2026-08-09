package com.nova.assistant.document;

import com.nova.assistant.ai.AiService;
import com.nova.assistant.common.ApiException;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class DocumentAnalysisService {

    private static final int MAX_CHARS = 12000;

    private static final String SYSTEM = """
            Eres NOVA, una analista de documentos meticulosa. Resume el contenido proporcionado,
            extrae los puntos clave, entidades y fechas relevantes, y responde a la peticion del
            usuario. Responde en espanol, de forma estructurada y concisa.
            """;

    private final AiService aiService;

    public DocumentAnalysisResponse analyze(MultipartFile file, String prompt) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("No se ha proporcionado ningun archivo");
        }
        String contentType = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
        String text = extractText(file, contentType);
        if (text.isBlank()) {
            throw ApiException.badRequest("No se ha podido extraer texto del archivo (formato no soportado para analisis offline)");
        }
        if (text.length() > MAX_CHARS) {
            text = text.substring(0, MAX_CHARS) + "\n\n[...documento truncado para el analisis...]";
        }

        String instruction = (prompt == null || prompt.isBlank())
                ? "Resume el documento y enumera los puntos clave."
                : prompt.trim();

        String userContent = instruction + "\n\n--- Contenido del documento (" + file.getOriginalFilename() + ") ---\n" + text;
        String analysis = aiService.oneShot(SYSTEM, userContent);

        return new DocumentAnalysisResponse(file.getOriginalFilename(), contentType, text.length(), analysis);
    }

    public String extractPlainText(MultipartFile file) {
        String ct = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
        return extractText(file, ct);
    }

    private String extractText(MultipartFile file, String contentType) {
        try {
            if (contentType.contains("pdf") || isPdfName(file.getOriginalFilename())) {
                try (PDDocument document = PDDocument.load(file.getInputStream())) {
                    return new PDFTextStripper().getText(document).trim();
                }
            }
            if (contentType.startsWith("text/") || contentType.contains("json")
                    || contentType.contains("csv") || contentType.contains("xml")
                    || contentType.contains("markdown")) {
                return new String(file.getBytes(), StandardCharsets.UTF_8).trim();
            }
            if (contentType.startsWith("image/")) {
                // Vision analysis requires a multimodal live provider; offline we describe limits.
                return "Imagen recibida (" + contentType + "). El analisis visual detallado requiere un "
                        + "modelo multimodal conectado (OpenAI). Nombre del archivo: " + file.getOriginalFilename();
            }
            // best-effort: treat as UTF-8 text
            return new String(file.getBytes(), StandardCharsets.UTF_8).trim();
        } catch (Exception e) {
            throw ApiException.badRequest("No se ha podido leer el archivo: " + e.getMessage());
        }
    }

    private boolean isPdfName(String name) {
        return name != null && name.toLowerCase().endsWith(".pdf");
    }
}
