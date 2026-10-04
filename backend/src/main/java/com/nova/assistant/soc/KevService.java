package com.nova.assistant.soc;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * CISA Known Exploited Vulnerabilities (KEV) catalog: vulnerabilities confirmed as exploited in the wild.
 * Public JSON feed, cached in memory for a few hours.
 */
@Service
public class KevService {

    private static final Logger log = LoggerFactory.getLogger(KevService.class);
    private static final String FEED =
            "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
    private static final Duration TTL = Duration.ofHours(4);

    public record KevEntry(String cveId, String vendor, String product, String name, LocalDate dateAdded,
                           String description, String requiredAction, LocalDate dueDate, boolean ransomware) { }

    private final RestClient client;
    private volatile List<KevEntry> cache = List.of();
    private volatile Instant fetchedAt = Instant.EPOCH;

    public KevService(RestClient.Builder builder) {
        this.client = builder.clone().build();
    }

    /** Entries added in the last {@code days} days, newest first, optionally filtered by vendor/product keyword. */
    public List<KevEntry> recent(int days, String keyword) {
        LocalDate since = LocalDate.now().minusDays(Math.max(1, Math.min(days, 90)));
        String k = keyword == null ? "" : keyword.trim().toLowerCase(Locale.ROOT);
        List<KevEntry> out = new ArrayList<>();
        for (KevEntry e : catalog()) {
            if (e.dateAdded() == null || e.dateAdded().isBefore(since)) continue;
            if (!k.isEmpty() && !(e.vendor() + " " + e.product()).toLowerCase(Locale.ROOT).contains(k)) continue;
            out.add(e);
        }
        out.sort(Comparator.comparing(KevEntry::dateAdded).reversed());
        return out;
    }

    public synchronized List<KevEntry> catalog() {
        if (!cache.isEmpty() && Instant.now().isBefore(fetchedAt.plus(TTL))) return cache;
        try {
            JsonNode root = client.get().uri(FEED).retrieve().body(JsonNode.class);
            List<KevEntry> list = new ArrayList<>();
            if (root != null && root.path("vulnerabilities").isArray()) {
                for (JsonNode v : root.path("vulnerabilities")) {
                    list.add(new KevEntry(
                            v.path("cveID").asText(""),
                            v.path("vendorProject").asText(""),
                            v.path("product").asText(""),
                            v.path("vulnerabilityName").asText(""),
                            date(v.path("dateAdded").asText(null)),
                            v.path("shortDescription").asText(""),
                            v.path("requiredAction").asText(""),
                            date(v.path("dueDate").asText(null)),
                            "Known".equalsIgnoreCase(v.path("knownRansomwareCampaignUse").asText(""))));
                }
            }
            if (!list.isEmpty()) {
                cache = List.copyOf(list);
                fetchedAt = Instant.now();
            }
        } catch (Exception e) {
            log.warn("Could not refresh CISA KEV feed: {}", e.toString());
        }
        return cache;
    }

    private static LocalDate date(String s) {
        try { return s == null || s.isBlank() ? null : LocalDate.parse(s); } catch (Exception e) { return null; }
    }
}
