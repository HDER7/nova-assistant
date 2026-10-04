package com.nova.assistant.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns a tool call into a small structured "card" the HUD can render as a holographic panel
 * (risk gauge for VirusTotal, CVSS score for CVEs, counts for IOCs, confirmations for actions).
 * Built from the tool's arguments and its plain-text result, so ToolService stays unchanged.
 */
final class ToolCards {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Pattern VT = Pattern.compile("malicioso=(\\d+) sospechoso=(\\d+) inofensivo=(\\d+)");
    private static final Pattern CVSS = Pattern.compile("CVSS (\\d+(?:\\.\\d+)?) \\(([A-Z]+)\\)");
    private static final Pattern IOCS = Pattern.compile("IOCs detectados \\((\\d+)\\)");

    private ToolCards() { }

    static Map<String, Object> start(String id, String tool, String argsJson) {
        Map<String, Object> card = base(id, tool, "start");
        card.put("subtitle", subject(tool, argsJson));
        card.put("status", "running");
        return card;
    }

    static Map<String, Object> done(String id, String tool, String argsJson, String result) {
        Map<String, Object> card = base(id, tool, "done");
        String r = result == null ? "" : result;
        card.put("subtitle", subject(tool, argsJson));
        card.put("text", r.length() > 240 ? r.substring(0, 240) + "…" : r);
        if (r.startsWith("ERROR")) {
            card.put("status", "error");
            return card;
        }
        card.put("status", "ok");
        List<Map<String, Object>> metrics = new ArrayList<>();
        switch (tool == null ? "" : tool) {
            case "virustotal_lookup" -> {
                Matcher m = VT.matcher(r);
                if (m.find()) {
                    int mal = Integer.parseInt(m.group(1));
                    int sus = Integer.parseInt(m.group(2));
                    int harm = Integer.parseInt(m.group(3));
                    int total = Math.max(1, mal + sus + harm);
                    card.put("gauge", Math.min(1.0, (mal + sus) / (double) total));
                    card.put("status", mal > 0 ? "danger" : sus > 0 ? "warn" : "ok");
                    metrics.add(metric("Maliciosos", mal));
                    metrics.add(metric("Sospechosos", sus));
                    metrics.add(metric("Limpios", harm));
                }
            }
            case "cve_lookup" -> {
                Matcher m = CVSS.matcher(r);
                if (m.find()) {
                    double score = Double.parseDouble(m.group(1));
                    card.put("gauge", Math.min(1.0, score / 10.0));
                    card.put("status", score >= 9 ? "danger" : score >= 7 ? "warn" : "ok");
                    metrics.add(metric("CVSS", score));
                    metrics.add(metric("Severidad", m.group(2)));
                }
            }
            case "extract_iocs" -> {
                Matcher m = IOCS.matcher(r);
                if (m.find()) metrics.add(metric("IOCs", Integer.parseInt(m.group(1))));
            }
            case "kev_recent" -> {
                long n = r.lines().filter(l -> l.startsWith("- CVE-")).count();
                metrics.add(metric("Explotados", n));
                card.put("status", n > 0 ? "warn" : "ok");
            }
            default -> { /* action tools: confirmation only */ }
        }
        if (!metrics.isEmpty()) card.put("metrics", metrics);
        return card;
    }

    private static Map<String, Object> base(String id, String tool, String phase) {
        Map<String, Object> card = new LinkedHashMap<>();
        card.put("id", id == null ? tool : id);
        card.put("tool", tool);
        card.put("phase", phase);
        card.put("title", label(tool));
        return card;
    }

    private static Map<String, Object> metric(String label, Object value) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("label", label);
        m.put("value", value);
        return m;
    }

    static String label(String tool) {
        return switch (tool == null ? "" : tool) {
            case "virustotal_lookup" -> "VirusTotal";
            case "cve_lookup" -> "Vulnerabilidad";
            case "extract_iocs" -> "Extracción de IOCs";
            case "web_search" -> "Búsqueda web";
            case "kev_recent" -> "CISA KEV";
            case "agenda" -> "Agenda";
            case "create_task" -> "Tarea";
            case "create_reminder" -> "Recordatorio";
            case "create_note" -> "Nota";
            case "create_calendar_event" -> "Evento";
            case "save_memory" -> "Memoria";
            case "list_tasks" -> "Tareas";
            default -> tool == null ? "Herramienta" : tool;
        };
    }

    private static String subject(String tool, String argsJson) {
        try {
            JsonNode a = MAPPER.readTree(argsJson == null || argsJson.isBlank() ? "{}" : argsJson);
            for (String k : new String[]{"indicator", "id", "query", "title", "content", "vendor", "status"}) {
                if (a.hasNonNull(k) && !a.get(k).asText().isBlank()) {
                    String v = a.get(k).asText();
                    return v.length() > 80 ? v.substring(0, 80) + "…" : v;
                }
            }
            if ("kev_recent".equals(tool) && a.has("days")) return "Últimos " + a.get("days").asInt() + " días";
        } catch (Exception ignored) {
            // malformed args from the model — no subtitle
        }
        return "";
    }
}
