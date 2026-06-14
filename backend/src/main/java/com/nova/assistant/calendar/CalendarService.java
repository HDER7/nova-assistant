package com.nova.assistant.calendar;

import com.nova.assistant.common.ApiException;
import com.nova.assistant.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CalendarService {

    private final CalendarEventRepository eventRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<CalendarEventResponse> list(UUID userId, Instant from, Instant to) {
        List<CalendarEvent> events = (from != null && to != null)
                ? eventRepository.findByUser_IdAndStartAtBetweenOrderByStartAtAsc(userId, from, to)
                : eventRepository.findByUser_IdOrderByStartAtAsc(userId);
        return events.stream().map(CalendarEventResponse::from).toList();
    }

    @Transactional
    public CalendarEventResponse create(UUID userId, CreateEventRequest req) {
        if (req.endAt().isBefore(req.startAt())) {
            throw ApiException.badRequest("La fecha de fin no puede ser anterior al inicio");
        }
        CalendarEvent event = CalendarEvent.builder()
                .user(userRepository.getReferenceById(userId))
                .title(req.title().trim())
                .description(req.description())
                .location(req.location())
                .startAt(req.startAt())
                .endAt(req.endAt())
                .allDay(req.allDay() != null && req.allDay())
                .color(req.color() == null || req.color().isBlank() ? "cyan" : req.color())
                .build();
        return CalendarEventResponse.from(eventRepository.save(event));
    }

    @Transactional
    public CalendarEventResponse update(UUID userId, UUID id, UpdateEventRequest req) {
        CalendarEvent event = owned(userId, id);
        if (req.title() != null && !req.title().isBlank()) event.setTitle(req.title().trim());
        if (req.description() != null) event.setDescription(req.description());
        if (req.location() != null) event.setLocation(req.location());
        if (req.startAt() != null) event.setStartAt(req.startAt());
        if (req.endAt() != null) event.setEndAt(req.endAt());
        if (req.allDay() != null) event.setAllDay(req.allDay());
        if (req.color() != null && !req.color().isBlank()) event.setColor(req.color());
        if (event.getEndAt().isBefore(event.getStartAt())) {
            throw ApiException.badRequest("La fecha de fin no puede ser anterior al inicio");
        }
        return CalendarEventResponse.from(eventRepository.save(event));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        eventRepository.delete(owned(userId, id));
    }

    private CalendarEvent owned(UUID userId, UUID id) {
        return eventRepository.findByIdAndUser_Id(id, userId)
                .orElseThrow(() -> ApiException.notFound("Evento no encontrado"));
    }
}
