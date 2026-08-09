package com.nova.assistant.reminder;

import com.nova.assistant.notification.NotificationService;
import com.nova.assistant.notification.NotificationType;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/** Dispara notificaciones in-app cuando llega la hora de un recordatorio. */
@Component
@RequiredArgsConstructor
public class ReminderScheduler {

    private final ReminderRepository reminderRepository;
    private final NotificationService notificationService;

    @Scheduled(fixedDelayString = "60000", initialDelayString = "20000")
    @Transactional
    public void fireDueReminders() {
        List<Reminder> due = reminderRepository
                .findByCompletedFalseAndNotifiedFalseAndRemindAtLessThanEqual(Instant.now());
        if (due.isEmpty()) return;
        for (Reminder r : due) {
            String body = (r.getNotes() != null && !r.getNotes().isBlank())
                    ? r.getNotes() : "Es la hora de tu recordatorio.";
            notificationService.push(r.getUser().getId(), NotificationType.REMINDER,
                    "Recordatorio: " + r.getTitle(), body, "/calendar");
            r.setNotified(true);
        }
        reminderRepository.saveAll(due);
    }
}
