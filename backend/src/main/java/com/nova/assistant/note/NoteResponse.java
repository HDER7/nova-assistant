package com.nova.assistant.note;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record NoteResponse(
        UUID id, String title, String content, List<String> tags, boolean pinned,
        Instant createdAt, Instant updatedAt
) {
    public static NoteResponse from(Note n) {
        List<String> tagList = (n.getTags() == null || n.getTags().isBlank())
                ? List.of()
                : List.of(n.getTags().split(",\\s*"));
        return new NoteResponse(n.getId(), n.getTitle(), n.getContent(), tagList, n.isPinned(),
                n.getCreatedAt(), n.getUpdatedAt());
    }
}
