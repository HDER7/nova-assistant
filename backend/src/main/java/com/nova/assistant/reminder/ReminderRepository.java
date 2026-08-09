package com.nova.assistant.reminder;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReminderRepository extends JpaRepository<Reminder, UUID> {
    List<Reminder> findByUser_IdOrderByRemindAtAsc(UUID userId);
    Optional<Reminder> findByIdAndUser_Id(UUID id, UUID userId);
    long countByUser_IdAndCompletedFalse(UUID userId);
    List<Reminder> findByCompletedFalseAndNotifiedFalseAndRemindAtLessThanEqual(Instant now);
}
