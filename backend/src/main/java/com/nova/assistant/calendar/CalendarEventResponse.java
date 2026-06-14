package com.nova.assistant.calendar;

import java.time.Instant;
import java.util.UUID;

public record CalendarEventResponse(
        UUID id, String title, String description, String location,
        Instant startAt, Instant endAt, boolean allDay, String color
) {
    public static CalendarEventResponse from(CalendarEvent e) {
        return new CalendarEventResponse(e.getId(), e.getTitle(), e.getDescription(), e.getLocation(),
                e.getStartAt(), e.getEndAt(), e.isAllDay(), e.getColor());
    }
}
