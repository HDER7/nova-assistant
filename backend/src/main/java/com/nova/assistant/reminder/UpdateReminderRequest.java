package com.nova.assistant.reminder;

import jakarta.validation.constraints.Size;

import java.time.Instant;

public record UpdateReminderRequest(
        @Size(max = 255) String title,
        String notes,
        Instant remindAt,
        String recurrence,
        Boolean completed
) {}
