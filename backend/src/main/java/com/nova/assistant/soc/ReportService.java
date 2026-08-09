package com.nova.assistant.soc;

import com.nova.assistant.common.ApiException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/** Renders a plain-text report into a simple, paginated PDF (PDFBox). */
@Service
public class ReportService {

    public byte[] generatePdf(String title, String content) {
        final float margin = 50f, fontSize = 10f, leading = 14f;
        try (PDDocument doc = new PDDocument()) {
            PDRectangle size = PDRectangle.A4;
            float maxWidth = size.getWidth() - 2 * margin;
            PDType1Font font = PDType1Font.HELVETICA;
            PDType1Font bold = PDType1Font.HELVETICA_BOLD;

            List<String> lines = new ArrayList<>();
            for (String raw : (content == null ? "" : content).split("\n", -1)) {
                lines.addAll(wrap(raw, font, fontSize, maxWidth));
            }

            PDPage page = new PDPage(size);
            doc.addPage(page);
            PDPageContentStream cs = new PDPageContentStream(doc, page);
            float y = size.getHeight() - margin;

            cs.beginText();
            cs.setFont(bold, 16);
            cs.newLineAtOffset(margin, y);
            cs.showText(sanitize(title == null || title.isBlank() ? "Informe NOVA" : title));
            cs.endText();
            y -= 26;

            for (String line : lines) {
                if (y <= margin) {
                    cs.close();
                    page = new PDPage(size);
                    doc.addPage(page);
                    cs = new PDPageContentStream(doc, page);
                    y = size.getHeight() - margin;
                }
                cs.beginText();
                cs.setFont(font, fontSize);
                cs.newLineAtOffset(margin, y);
                cs.showText(sanitize(line));
                cs.endText();
                y -= leading;
            }
            cs.close();

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo generar el PDF: " + e.getMessage());
        }
    }

    private List<String> wrap(String text, PDType1Font font, float fontSize, float maxWidth) throws IOException {
        List<String> out = new ArrayList<>();
        String clean = sanitize(text);
        if (clean.isEmpty()) { out.add(""); return out; }
        StringBuilder line = new StringBuilder();
        for (String w : clean.split(" ")) {
            String candidate = line.length() == 0 ? w : line + " " + w;
            if (font.getStringWidth(candidate) / 1000 * fontSize > maxWidth && line.length() > 0) {
                out.add(line.toString());
                line = new StringBuilder(w);
            } else {
                line = new StringBuilder(candidate);
            }
            while (font.getStringWidth(line.toString()) / 1000 * fontSize > maxWidth && line.length() > 1) {
                String s = line.toString();
                int cut = s.length();
                while (cut > 1 && font.getStringWidth(s.substring(0, cut)) / 1000 * fontSize > maxWidth) cut--;
                out.add(s.substring(0, cut));
                line = new StringBuilder(s.substring(cut));
            }
        }
        out.add(line.toString());
        return out;
    }

    private String sanitize(String s) {
        if (s == null) return "";
        return s.replace("—", "-").replace("–", "-").replace("…", "...").replace("•", "-")
                .replace("“", "\"").replace("”", "\"").replace("‘", "'").replace("’", "'")
                .replaceAll("[^\\x20-\\x7E\\xA0-\\xFF]", " ");
    }
}
