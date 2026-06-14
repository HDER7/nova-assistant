package com.nova.assistant.calendar;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record CreateEventRequest(
        @NotBlank @Size(max = 255) String title,
        String description,
        String location,
        @NotNull Instant startAt,
        @NotNull Instant endAt,
        Boolean allDay,
        String color
) {}
