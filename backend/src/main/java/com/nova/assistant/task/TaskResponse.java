package com.nova.assistant.task;

import java.time.Instant;
import java.util.UUID;

public record TaskResponse(
        UUID id, String title, String description, String status, String priority,
        Instant dueAt, Instant completedAt, Instant createdAt, Instant updatedAt
) {
    public static TaskResponse from(TaskEntity t) {
        return new TaskResponse(t.getId(), t.getTitle(), t.getDescription(), t.getStatus().name(),
                t.getPriority().name(), t.getDueAt(), t.getCompletedAt(), t.getCreatedAt(), t.getUpdatedAt());
    }
}
