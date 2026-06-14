package com.nova.assistant.calendar;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, UUID> {
    List<CalendarEvent> findByUser_IdOrderByStartAtAsc(UUID userId);
    List<CalendarEvent> findByUser_IdAndStartAtBetweenOrderByStartAtAsc(UUID userId, Instant from, Instant to);
    Optional<CalendarEvent> findByIdAndUser_Id(UUID id, UUID userId);
    long countByUser_IdAndStartAtGreaterThanEqual(UUID userId, Instant from);
}
