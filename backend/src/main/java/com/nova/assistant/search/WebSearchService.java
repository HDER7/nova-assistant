package com.nova.assistant.search;

import com.nova.assistant.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Real-time web search via the DuckDuckGo Instant Answer API (no API key required).
 * Resilient by design: any failure returns an empty list rather than throwing,
 * so the assistant keeps working even when outbound search is unavailable.
 */
@Service
public class WebSearchService {

    private static final Logger log = LoggerFactory.getLogger(WebSearchService.class);

    private final AppProperties properties;
    private final RestClient client;

    public WebSearchService(AppProperties properties, RestClient.Builder builder) {
        this.properties = properties;
        this.client = builder.build();
    }

    @SuppressWarnings("unchecked")
    public List<SearchResult> search(String query) {
        List<SearchResult> results = new ArrayList<>();
        if (!properties.getSearch().isEnabled() || query == null || query.isBlank()) {
            return results;
        }
        try {
            String url = UriComponentsBuilder.fromHttpUrl(properties.getSearch().getEndpoint())
                    .queryParam("q", query)
                    .queryParam("format", "json")
                    .queryParam("no_redirect", "1")
                    .queryParam("no_html", "1")
                    .build().toUriString();

            Map<String, Object> body = client.get().uri(url).retrieve().body(Map.class);
            if (body == null) return results;

            Object abstractText = body.get("AbstractText");
            Object abstractUrl = body.get("AbstractURL");
            Object heading = body.get("Heading");
            if (abstractText instanceof String s && !s.isBlank()) {
                results.add(new SearchResult(
                        heading instanceof String h && !h.isBlank() ? h : query,
                        s,
                        abstractUrl instanceof String u ? u : ""));
            }

            Object related = body.get("RelatedTopics");
            if (related instanceof List<?> topics) {
                for (Object o : topics) {
                    if (!(o instanceof Map)) continue;
                    Map<String, Object> topic = (Map<String, Object>) o;
                    Object text = topic.get("Text");
                    Object firstUrl = topic.get("FirstURL");
                    if (text instanceof String t && !t.isBlank()) {
                        String title = t.length() > 80 ? t.substring(0, 80) + "…" : t;
                        results.add(new SearchResult(title, t, firstUrl instanceof String f ? f : ""));
                    }
                    if (results.size() >= 8) break;
                }
            }
        } catch (Exception e) {
            log.warn("Web search failed for '{}': {}", query, e.getMessage());
        }
        return results;
    }
}
