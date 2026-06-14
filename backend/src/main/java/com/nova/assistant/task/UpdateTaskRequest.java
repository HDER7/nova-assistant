package com.nova.assistant.task;

import jakarta.validation.constraints.Size;

import java.time.Instant;

public record UpdateTaskRequest(
        @Size(max = 255) String title,
        String description,
        String status,
        String priority,
        Instant dueAt
) {}
