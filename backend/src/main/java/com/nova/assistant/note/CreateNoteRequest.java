package com.nova.assistant.note;

import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateNoteRequest(
        @Size(max = 255) String title,
        String content,
        List<String> tags
) {}
