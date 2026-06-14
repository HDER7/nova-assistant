package com.nova.assistant.notification;

import com.nova.assistant.common.ApiException;
import com.nova.assistant.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<NotificationResponse> list(UUID userId) {
        return notificationRepository.findTop50ByUser_IdOrderByCreatedAtDesc(userId)
                .stream().map(NotificationResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return notificationRepository.countByUser_IdAndReadFalse(userId);
    }

    @Transactional
    public NotificationResponse create(UUID userId, CreateNotificationRequest req) {
        return NotificationResponse.from(push(userId, parse(req.type()), req.title(), req.body(), req.actionUrl()));
    }

    /** Internal helper other modules can use to raise a notification. */
    @Transactional
    public Notification push(UUID userId, NotificationType type, String title, String body, String actionUrl) {
        Notification n = Notification.builder()
                .user(userRepository.getReferenceById(userId))
                .type(type)
                .title(title)
                .body(body)
                .actionUrl(actionUrl)
                .build();
        return notificationRepository.save(n);
    }

    @Transactional
    public NotificationResponse markRead(UUID userId, UUID id) {
        Notification n = notificationRepository.findByIdAndUser_Id(id, userId)
                .orElseThrow(() -> ApiException.notFound("Notificacion no encontrada"));
        n.setRead(true);
        return NotificationResponse.from(notificationRepository.save(n));
    }

    @Transactional
    public int markAllRead(UUID userId) {
        return notificationRepository.markAllRead(userId);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        Notification n = notificationRepository.findByIdAndUser_Id(id, userId)
                .orElseThrow(() -> ApiException.notFound("Notificacion no encontrada"));
        notificationRepository.delete(n);
    }

    private NotificationType parse(String s) {
        if (s == null || s.isBlank()) return NotificationType.INFO;
        try { return NotificationType.valueOf(s.toUpperCase()); }
        catch (Exception e) { return NotificationType.INFO; }
    }
}
