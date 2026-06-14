package com.nova.assistant.soc;

import com.nova.assistant.ai.AiService;
import com.nova.assistant.config.AppProperties;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * SOC analyst toolkit: IOC extraction, defang/refang, multi-format decoding,
 * CVE enrichment (NVD), and AI-assisted alert triage / phishing analysis.
 */
@Service
@RequiredArgsConstructor
public class SocService {

    private static final Logger log = LoggerFactory.getLogger(SocService.class);

    private static final Pattern IPV4 = Pattern.compile(
            "\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d?\\d)\\b");
    private static final Pattern URL = Pattern.compile("(?i)\\bhttps?://[^\\s\"'<>\\]\\)]+");
    private static final Pattern EMAIL = Pattern.compile(
            "\\b[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}\\b");
    private static final Pattern SHA256 = Pattern.compile("\\b[a-fA-F0-9]{64}\\b");
    private static final Pattern SHA1 = Pattern.compile("\\b[a-fA-F0-9]{40}\\b");
    private static final Pattern MD5 = Pattern.compile("\\b[a-fA-F0-9]{32}\\b");
    private static final Pattern CVE = Pattern.compile("(?i)CVE-\\d{4}-\\d{4,7}");
    private static final Pattern DOMAIN = Pattern.compile(
            "\\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}\\b");

    private static final Set<String> FILE_EXT = Set.of(
            "exe", "dll", "pdf", "doc", "docx", "xls", "xlsx", "txt", "png", "jpg", "jpeg",
            "gif", "log", "json", "js", "ts", "csv", "zip", "rar", "php", "html", "htm",
            "py", "sh", "bat", "ps1", "yml", "yaml", "md", "xml", "sql", "jar", "msi", "dat");

    private static final String TRIAGE_SYSTEM = """
            Eres un analista SOC senior (Tier 2/3). Analiza el log, evento o alerta proporcionado y devuelve:
            1) Resumen de lo ocurrido. 2) Severidad estimada (Informativa/Baja/Media/Alta/Critica) con justificacion.
            3) IOCs relevantes detectados. 4) Mapeo a tecnicas MITRE ATT&CK (IDs Txxxx) cuando aplique.
            5) Probabilidad de falso positivo. 6) Acciones de contencion e investigacion recomendadas.
            Responde en espanol, estructurado y conciso, util para un turno de SOC.
            """;

    private static final String PHISHING_SYSTEM = """
            Eres un analista de seguridad especializado en phishing. Analiza el correo (cabeceras y/o cuerpo):
            evalua SPF/DKIM/DMARC si aparecen, dominios y enlaces sospechosos, suplantacion de marca/remitente,
            sentido de urgencia y senuelos. Extrae IOCs (remitente, URLs, dominios, IPs). Asigna un veredicto
            (Legitimo/Sospechoso/Phishing) y un nivel de riesgo (Bajo/Medio/Alto). Recomienda acciones.
            Responde en espanol, estructurado.
            """;

    private final AiService aiService;
    private final RestClient.Builder restClientBuilder;
    private final AppProperties properties;

    // ---------- IOC extraction ----------

    public IocResult extractIocs(String raw) {
        String refanged = refang(raw);
        boolean wasDefanged = !refanged.equals(raw);

        List<String> urls = findAll(URL, refanged);
        List<String> emails = findAll(EMAIL, refanged);

        // Remove URLs and emails before domain scan to reduce noise.
        String stripped = refanged;
        for (String u : urls) stripped = stripped.replace(u, " ");
        for (String e : emails) stripped = stripped.replace(e, " ");

        List<String> ips = findAll(IPV4, refanged);
        List<String> sha256 = findAll(SHA256, refanged);
        List<String> sha1 = findAll(SHA1, refanged);
        List<String> md5 = findAll(MD5, refanged);
        List<String> cves = upper(findAll(CVE, refanged));

        List<String> domains = new ArrayList<>();
        for (String d : findAll(DOMAIN, stripped)) {
            String tld = d.substring(d.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
            if (FILE_EXT.contains(tld)) continue;          // likely a filename
            if (ips.contains(d)) continue;
            domains.add(d);
        }

        int total = ips.size() + domains.size() + urls.size() + emails.size()
                + md5.size() + sha1.size() + sha256.size() + cves.size();

        return new IocResult(ips, dedupe(domains), urls, emails, md5, sha1, sha256, cves, wasDefanged, total);
    }

    private List<String> findAll(Pattern p, String text) {
        Set<String> out = new LinkedHashSet<>();
        Matcher m = p.matcher(text);
        while (m.find()) out.add(m.group());
        return new ArrayList<>(out);
    }

    private List<String> dedupe(List<String> in) {
        return new ArrayList<>(new LinkedHashSet<>(in));
    }

    private List<String> upper(List<String> in) {
        List<String> out = new ArrayList<>();
        for (String s : in) out.add(s.toUpperCase(Locale.ROOT));
        return dedupe(out);
    }

    // ---------- Defang / Refang ----------

    public String refang(String s) {
        if (s == null) return "";
        String r = s;
        r = r.replace("[.]", ".").replace("(.)", ".").replace("{.}", ".");
        r = r.replaceAll("(?i)\\[dot\\]", ".").replaceAll("(?i)\\(dot\\)", ".").replaceAll("(?i)\\{dot\\}", ".");
        r = r.replace("[:]", ":").replace("[://]", "://");
        r = r.replace("[@]", "@").replace("(@)", "@").replaceAll("(?i)\\[at\\]", "@");
        r = r.replaceAll("(?i)hxxps", "https").replaceAll("(?i)hxxp", "http").replaceAll("(?i)hxtps", "https");
        return r;
    }

    public String defang(String s) {
        if (s == null) return "";
        String r = s;
        r = r.replaceAll("(?i)https", "hxxps").replaceAll("(?i)http", "hxxp");
        r = r.replace(".", "[.]");
        r = r.replace("@", "[@]");
        return r;
    }

    // ---------- Decoder ----------

    public DecodeResult decode(String input, String mode) {
        String m = (mode == null || mode.isBlank()) ? "base64" : mode.toLowerCase(Locale.ROOT);
        try {
            return switch (m) {
                case "base64" -> new DecodeResult(m,
                        new String(Base64.getMimeDecoder().decode(input.trim()), StandardCharsets.UTF_8), true);
                case "hex" -> new DecodeResult(m, hexDecode(input), true);
                case "url" -> new DecodeResult(m, URLDecoder.decode(input, StandardCharsets.UTF_8), true);
                case "jwt" -> new DecodeResult(m, jwtDecode(input), true);
                case "defang" -> new DecodeResult(m, defang(input), true);
                case "refang" -> new DecodeResult(m, refang(input), true);
                default -> new DecodeResult(m, "Modo no soportado: " + m, false);
            };
        } catch (Exception e) {
            return new DecodeResult(m, "No se pudo decodificar como " + m + ": " + e.getMessage(), false);
        }
    }

    private String hexDecode(String input) {
        String hex = input.replaceAll("(?i)0x", "").replaceAll("[^0-9a-fA-F]", "");
        if (hex.length() % 2 != 0) throw new IllegalArgumentException("longitud hex impar");
        byte[] bytes = new byte[hex.length() / 2];
        for (int i = 0; i < bytes.length; i++) {
            bytes[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return new String(bytes, StandardCharsets.UTF_8);
    }

    private String jwtDecode(String input) {
        String[] parts = input.trim().split("\\.");
        if (parts.length < 2) throw new IllegalArgumentException("no parece un JWT");
        Base64.Decoder dec = Base64.getUrlDecoder();
        String header = new String(dec.decode(pad(parts[0])), StandardCharsets.UTF_8);
        String payload = new String(dec.decode(pad(parts[1])), StandardCharsets.UTF_8);
        return "HEADER:\n" + header + "\n\nPAYLOAD:\n" + payload
                + (parts.length > 2 ? "\n\n(firma no verificada)" : "");
    }

    private String pad(String b64) {
        int m = b64.length() % 4;
        return m == 0 ? b64 : b64 + "====".substring(m);
    }

    // ---------- CVE lookup (NVD) ----------

    @SuppressWarnings("unchecked")
    public CveResult cveLookup(String rawId) {
        String id = rawId == null ? "" : rawId.trim().toUpperCase(Locale.ROOT);
        if (!id.matches("CVE-\\d{4}-\\d{4,7}")) {
            return new CveResult(id, null, null, null, null, List.of(), false, "Formato de CVE invalido (CVE-AAAA-NNNN)");
        }
        try {
            RestClient client = restClientBuilder.build();
            Map<String, Object> body = client.get()
                    .uri("https://services.nvd.nist.gov/rest/json/cves/2.0?cveId={id}", id)
                    .retrieve().body(Map.class);
            if (body == null) return notFound(id);
            List<Map<String, Object>> vulns = (List<Map<String, Object>>) body.get("vulnerabilities");
            if (vulns == null || vulns.isEmpty()) return notFound(id);
            Map<String, Object> cve = (Map<String, Object>) vulns.get(0).get("cve");

            String description = "";
            List<Map<String, Object>> descs = (List<Map<String, Object>>) cve.get("descriptions");
            if (descs != null) {
                for (Map<String, Object> d : descs) {
                    if ("en".equals(d.get("lang"))) { description = String.valueOf(d.get("value")); break; }
                }
            }

            Double score = null;
            String severity = null;
            Map<String, Object> metrics = (Map<String, Object>) cve.get("metrics");
            if (metrics != null) {
                for (String key : List.of("cvssMetricV31", "cvssMetricV30", "cvssMetricV2")) {
                    List<Map<String, Object>> list = (List<Map<String, Object>>) metrics.get(key);
                    if (list != null && !list.isEmpty()) {
                        Map<String, Object> data = (Map<String, Object>) list.get(0).get("cvssData");
                        if (data != null && data.get("baseScore") != null) {
                            score = Double.valueOf(String.valueOf(data.get("baseScore")));
                            Object sev = data.get("baseSeverity") != null ? data.get("baseSeverity") : list.get(0).get("baseSeverity");
                            severity = sev == null ? null : String.valueOf(sev);
                            break;
                        }
                    }
                }
            }

            List<String> refs = new ArrayList<>();
            List<Map<String, Object>> references = (List<Map<String, Object>>) cve.get("references");
            if (references != null) {
                for (Map<String, Object> r : references) {
                    Object u = r.get("url");
                    if (u != null && refs.size() < 6) refs.add(String.valueOf(u));
                }
            }
            String published = String.valueOf(cve.getOrDefault("published", ""));
            return new CveResult(id, description, score, severity, published, refs, true, null);
        } catch (Exception e) {
            log.warn("CVE lookup failed for {}: {}", id, e.getMessage());
            return new CveResult(id, null, null, null, null, List.of(), false,
                    "No se pudo consultar la NVD (limite de tasa o sin conectividad).");
        }
    }

    private CveResult notFound(String id) {
        return new CveResult(id, null, null, null, null, List.of(), false, "CVE no encontrado en la NVD");
    }

    // ---------- AI-assisted ----------

    public SocAnalysis triage(String content) {
        return new SocAnalysis(aiService.oneShot(TRIAGE_SYSTEM, content));
    }

    public SocAnalysis phishing(String content) {
        return new SocAnalysis(aiService.oneShot(PHISHING_SYSTEM, content));
    }

    // ---------- VirusTotal enrichment ----------

    public VtResult enrichVt(String rawIndicator) {
        String key = properties.getSoc().getVirustotal().getApiKey();
        if (key == null || key.isBlank()) {
            return new VtResult(rawIndicator, "?", null, 0, 0, 0, 0, null, null, null, false,
                    "VirusTotal no configurado (define VIRUSTOTAL_API_KEY).");
        }
        String indicator = refang(rawIndicator).trim();
        String type;
        String path;
        String guiType;
        String guiId;
        if (IPV4.matcher(indicator).matches()) {
            type = "ip"; path = "/ip_addresses/" + indicator; guiType = "ip-address"; guiId = indicator;
        } else if (SHA256.matcher(indicator).matches() || SHA1.matcher(indicator).matches() || MD5.matcher(indicator).matches()) {
            type = "file"; path = "/files/" + indicator; guiType = "file"; guiId = indicator;
        } else if (URL.matcher(indicator).find()) {
            String id = Base64.getUrlEncoder().withoutPadding().encodeToString(indicator.getBytes(StandardCharsets.UTF_8));
            type = "url"; path = "/urls/" + id; guiType = "url"; guiId = id;
        } else if (DOMAIN.matcher(indicator).find()) {
            type = "domain"; path = "/domains/" + indicator; guiType = "domain"; guiId = indicator;
        } else {
            return new VtResult(indicator, "?", null, 0, 0, 0, 0, null, null, null, false,
                    "Tipo de indicador no reconocido (IP, dominio, URL o hash).");
        }
        String link = "https://www.virustotal.com/gui/" + guiType + "/" + guiId;
        try {
            RestClient client = restClientBuilder.build();
            @SuppressWarnings("unchecked")
            Map<String, Object> body = client.get()
                    .uri("https://www.virustotal.com/api/v3" + path)
                    .header("x-apikey", key)
                    .retrieve().body(Map.class);
            if (body == null || body.get("data") == null) {
                return new VtResult(indicator, type, null, 0, 0, 0, 0, null, null, link, false, "Sin datos en VirusTotal.");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) body.get("data");
            @SuppressWarnings("unchecked")
            Map<String, Object> attr = (Map<String, Object>) data.get("attributes");
            @SuppressWarnings("unchecked")
            Map<String, Object> stats = attr == null ? null : (Map<String, Object>) attr.get("last_analysis_stats");
            int mal = stats == null ? 0 : num(stats.get("malicious"));
            int susp = stats == null ? 0 : num(stats.get("suspicious"));
            int harm = stats == null ? 0 : num(stats.get("harmless"));
            int undet = stats == null ? 0 : num(stats.get("undetected"));
            Integer reputation = (attr != null && attr.get("reputation") != null) ? num(attr.get("reputation")) : null;
            String verdict = mal > 0 ? "Malicioso" : susp > 0 ? "Sospechoso" : (harm > 0 ? "Limpio" : "Sin detecciones");
            String details = buildVtDetails(type, attr);
            return new VtResult(indicator, type, verdict, mal, susp, harm, undet, reputation, details, link, true, null);
        } catch (Exception e) {
            log.warn("VirusTotal lookup failed for {}: {}", indicator, e.getMessage());
            String msg = e.getMessage() != null && e.getMessage().contains("404")
                    ? "No encontrado en VirusTotal."
                    : "Error consultando VirusTotal (limite 4/min - 500/dia, o conectividad).";
            return new VtResult(indicator, type, null, 0, 0, 0, 0, null, null, link, false, msg);
        }
    }

    private int num(Object o) {
        if (o == null) return 0;
        try { return (int) Double.parseDouble(String.valueOf(o)); } catch (Exception e) { return 0; }
    }

    private String buildVtDetails(String type, Map<String, Object> attr) {
        if (attr == null) return "";
        StringBuilder sb = new StringBuilder();
        switch (type) {
            case "ip" -> { appendKv(sb, "AS owner", attr.get("as_owner")); appendKv(sb, "Pais", attr.get("country")); }
            case "domain" -> appendKv(sb, "Registrar", attr.get("registrar"));
            case "file" -> { appendKv(sb, "Tipo", attr.get("type_description")); appendKv(sb, "Nombre", attr.get("meaningful_name")); }
            case "url" -> appendKv(sb, "URL", attr.get("url"));
            default -> { }
        }
        return sb.toString().trim();
    }

    private void appendKv(StringBuilder sb, String label, Object val) {
        if (val != null && !String.valueOf(val).isBlank()) {
            sb.append(label).append(": ").append(val).append("   ");
        }
    }

}
