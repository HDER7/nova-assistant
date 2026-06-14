package com.nova.assistant.conversation.dto;

import com.nova.assistant.conversation.Message;

import java.time.Instant;
import java.util.UUID;

public record MessageResponse(
        UUID id,
        String role,
        String content,
        int tokens,
        Instant createdAt
) {
    public static MessageResponse from(Message m) {
        return new MessageResponse(m.getId(), m.getRole().name(), m.getContent(), m.getTokens(), m.getCreatedAt());
    }
}
