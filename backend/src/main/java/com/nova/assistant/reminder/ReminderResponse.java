package com.nova.assistant.reminder;

import java.time.Instant;
import java.util.UUID;

public record ReminderResponse(
        UUID id, String title, String notes, Instant remindAt, String recurrence,
        boolean completed, Instant createdAt
) {
    public static ReminderResponse from(Reminder r) {
        return new ReminderResponse(r.getId(), r.getTitle(), r.getNotes(), r.getRemindAt(),
                r.getRecurrence().name(), r.isCompleted(), r.getCreatedAt());
    }
}
