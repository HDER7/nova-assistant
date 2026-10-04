package com.nova.assistant.proactive;

import com.nova.assistant.calendar.CalendarEvent;
import com.nova.assistant.calendar.CalendarEventRepository;
import com.nova.assistant.notification.NotificationService;
import com.nova.assistant.notification.NotificationType;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/** JARVIS-style heads-up: "En 10 minutos: reunión de turno". The frontend speaks it aloud. */
@Component
@RequiredArgsConstructor
public class EventHeadsUpScheduler {

    private static final Duration LEAD = Duration.ofMinutes(10);

    private final CalendarEventRepository eventRepository;
    private final NotificationService notificationService;

    @Scheduled(fixedDelayString = "60000", initialDelayString = "30000")
    @Transactional
    public void announceUpcoming() {
        Instant now = Instant.now();
        List<CalendarEvent> soon = eventRepository.findByHeadsUpSentFalseAndStartAtBetween(now, now.plus(LEAD));
        if (soon.isEmpty()) return;
        for (CalendarEvent e : soon) {
            long minutes = Math.max(1, Duration.between(now, e.getStartAt()).toMinutes());
            String body = (e.getLocation() != null && !e.getLocation().isBlank() ? "Lugar: " + e.getLocation() + ". " : "")
                    + "Empieza en " + minutes + (minutes == 1 ? " minuto." : " minutos.");
            notificationService.push(e.getUser().getId(), NotificationType.REMINDER,
                    "En " + minutes + " min: " + e.getTitle(), body, "/calendar");
            e.setHeadsUpSent(true);
        }
        eventRepository.saveAll(soon);
    }
}
