package com.nova.assistant.conversation.dto;

import com.nova.assistant.conversation.Conversation;

import java.time.Instant;
import java.util.UUID;

public record ConversationResponse(
        UUID id,
        String title,
        boolean pinned,
        Instant createdAt,
        Instant updatedAt
) {
    public static ConversationResponse from(Conversation c) {
        return new ConversationResponse(c.getId(), c.getTitle(), c.isPinned(), c.getCreatedAt(), c.getUpdatedAt());
    }
}
