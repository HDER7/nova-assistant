package com.nova.assistant.calendar;

import jakarta.validation.constraints.Size;

import java.time.Instant;

public record UpdateEventRequest(
        @Size(max = 255) String title,
        String description,
        String location,
        Instant startAt,
        Instant endAt,
        Boolean allDay,
        String color
) {}
