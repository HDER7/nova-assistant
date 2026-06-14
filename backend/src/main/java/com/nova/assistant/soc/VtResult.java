package com.nova.assistant.soc;

public record VtResult(
        String indicator,
        String type,
        String verdict,
        int malicious,
        int suspicious,
        int harmless,
        int undetected,
        Integer reputation,
        String details,
        String link,
        boolean found,
        String note
) {}
