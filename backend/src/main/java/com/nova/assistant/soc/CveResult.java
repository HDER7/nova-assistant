package com.nova.assistant.soc;

import java.util.List;

public record CveResult(
        String id,
        String description,
        Double cvssScore,
        String severity,
        String published,
        List<String> references,
        boolean found,
        String note
) {}
