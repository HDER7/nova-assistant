package com.nova.assistant.document;

public record DocumentAnalysisResponse(
        String filename,
        String contentType,
        int characters,
        String analysis
) {}
