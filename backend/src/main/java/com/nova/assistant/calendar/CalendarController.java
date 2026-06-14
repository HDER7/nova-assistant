package com.nova.assistant.calendar;

import com.nova.assistant.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/calendar/events")
@RequiredArgsConstructor
public class CalendarController {

    private final CalendarService calendarService;

    @GetMapping
    public List<CalendarEventResponse> list(
            @AuthenticationPrincipal SecurityUser principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return calendarService.list(principal.getId(), from, to);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CalendarEventResponse create(@AuthenticationPrincipal SecurityUser principal,
                                        @Valid @RequestBody CreateEventRequest req) {
        return calendarService.create(principal.getId(), req);
    }

    @PatchMapping("/{id}")
    public CalendarEventResponse update(@AuthenticationPrincipal SecurityUser principal,
                                        @PathVariable UUID id, @Valid @RequestBody UpdateEventRequest req) {
        return calendarService.update(principal.getId(), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal SecurityUser principal, @PathVariable UUID id) {
        calendarService.delete(principal.getId(), id);
    }
}
