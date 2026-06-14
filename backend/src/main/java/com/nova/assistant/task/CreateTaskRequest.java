package com.nova.assistant.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record CreateTaskRequest(
        @NotBlank @Size(max = 255) String title,
        String description,
        String priority,
        Instant dueAt
) {}
