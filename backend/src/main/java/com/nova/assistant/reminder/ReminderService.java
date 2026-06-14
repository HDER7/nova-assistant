package com.nova.assistant.reminder;

import com.nova.assistant.common.ApiException;
import com.nova.assistant.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReminderService {

    private final ReminderRepository reminderRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<ReminderResponse> list(UUID userId) {
        return reminderRepository.findByUser_IdOrderByRemindAtAsc(userId)
                .stream().map(ReminderResponse::from).toList();
    }

    @Transactional
    public ReminderResponse create(UUID userId, CreateReminderRequest req) {
        Reminder reminder = Reminder.builder()
                .user(userRepository.getReferenceById(userId))
                .title(req.title().trim())
                .notes(req.notes())
                .remindAt(req.remindAt())
                .recurrence(parse(req.recurrence()))
                .build();
        return ReminderResponse.from(reminderRepository.save(reminder));
    }

    @Transactional
    public ReminderResponse update(UUID userId, UUID id, UpdateReminderRequest req) {
        Reminder reminder = owned(userId, id);
        if (req.title() != null && !req.title().isBlank()) reminder.setTitle(req.title().trim());
        if (req.notes() != null) reminder.setNotes(req.notes());
        if (req.remindAt() != null) reminder.setRemindAt(req.remindAt());
        if (req.recurrence() != null) reminder.setRecurrence(parse(req.recurrence()));
        if (req.completed() != null) reminder.setCompleted(req.completed());
        return ReminderResponse.from(reminderRepository.save(reminder));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        reminderRepository.delete(owned(userId, id));
    }

    private Reminder owned(UUID userId, UUID id) {
        return reminderRepository.findByIdAndUser_Id(id, userId)
                .orElseThrow(() -> ApiException.notFound("Recordatorio no encontrado"));
    }

    private Recurrence parse(String s) {
        if (s == null || s.isBlank()) return Recurrence.NONE;
        try { return Recurrence.valueOf(s.toUpperCase()); }
        catch (Exception e) { return Recurrence.NONE; }
    }
}
