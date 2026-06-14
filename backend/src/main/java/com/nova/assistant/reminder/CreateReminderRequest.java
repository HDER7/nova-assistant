package com.nova.assistant.reminder;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record CreateReminderRequest(
        @NotBlank @Size(max = 255) String title,
        String notes,
        @NotNull Instant remindAt,
        String recurrence
) {}
