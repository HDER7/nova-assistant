package com.nova.assistant.dashboard;

import com.nova.assistant.calendar.CalendarEventRepository;
import com.nova.assistant.conversation.ConversationRepository;
import com.nova.assistant.memory.MemoryRepository;
import com.nova.assistant.note.NoteRepository;
import com.nova.assistant.notification.NotificationRepository;
import com.nova.assistant.reminder.ReminderRepository;
import com.nova.assistant.task.TaskRepository;
import com.nova.assistant.task.TaskStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final TaskRepository taskRepository;
    private final NoteRepository noteRepository;
    private final ReminderRepository reminderRepository;
    private final CalendarEventRepository eventRepository;
    private final ConversationRepository conversationRepository;
    private final MemoryRepository memoryRepository;
    private final NotificationRepository notificationRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> summary(UUID userId) {
        Map<String, Long> tasks = new LinkedHashMap<>();
        tasks.put("total", taskRepository.countByUser_Id(userId));
        tasks.put("todo", taskRepository.countByUser_IdAndStatus(userId, TaskStatus.TODO));
        tasks.put("inProgress", taskRepository.countByUser_IdAndStatus(userId, TaskStatus.IN_PROGRESS));
        tasks.put("done", taskRepository.countByUser_IdAndStatus(userId, TaskStatus.DONE));

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("tasks", tasks);
        summary.put("notes", noteRepository.countByUser_Id(userId));
        summary.put("remindersPending", reminderRepository.countByUser_IdAndCompletedFalse(userId));
        summary.put("upcomingEvents", eventRepository.countByUser_IdAndStartAtGreaterThanEqual(userId, Instant.now()));
        summary.put("conversations", conversationRepository.countByUser_Id(userId));
        summary.put("memories", memoryRepository.countByUser_Id(userId));
        summary.put("unreadNotifications", notificationRepository.countByUser_IdAndReadFalse(userId));
        return summary;
    }
}
