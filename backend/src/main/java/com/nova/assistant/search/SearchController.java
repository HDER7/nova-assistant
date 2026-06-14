package com.nova.assistant.search;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final WebSearchService webSearchService;

    @GetMapping
    public Map<String, Object> search(@RequestParam("q") String query) {
        List<SearchResult> results = webSearchService.search(query);
        return Map.of("query", query, "results", results, "count", results.size());
    }
}
