package com.nova.assistant.memory.dto;

import com.nova.assistant.memory.MemoryItem;

import java.time.Instant;
import java.util.UUID;

public record MemoryResponse(
        UUID id,
        String content,
        String kind,
        int importance,
        String source,
        Instant createdAt
) {
    public static MemoryResponse from(MemoryItem m) {
        return new MemoryResponse(m.getId(), m.getContent(), m.getKind().name(),
                m.getImportance(), m.getSource(), m.getCreatedAt());
    }
}
