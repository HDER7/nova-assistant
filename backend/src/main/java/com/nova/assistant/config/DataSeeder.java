package com.nova.assistant.config;

import com.nova.assistant.calendar.CalendarEvent;
import com.nova.assistant.calendar.CalendarEventRepository;
import com.nova.assistant.conversation.*;
import com.nova.assistant.memory.MemoryItem;
import com.nova.assistant.memory.MemoryKind;
import com.nova.assistant.memory.MemoryRepository;
import com.nova.assistant.note.Note;
import com.nova.assistant.note.NoteRepository;
import com.nova.assistant.notification.Notification;
import com.nova.assistant.notification.NotificationRepository;
import com.nova.assistant.notification.NotificationType;
import com.nova.assistant.reminder.Reminder;
import com.nova.assistant.reminder.ReminderRepository;
import com.nova.assistant.task.TaskEntity;
import com.nova.assistant.task.TaskPriority;
import com.nova.assistant.task.TaskRepository;
import com.nova.assistant.task.TaskStatus;
import com.nova.assistant.user.Role;
import com.nova.assistant.user.User;
import com.nova.assistant.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * Seeds a ready-to-use demo account on first boot so the product is fully
 * explorable without manual setup. Runs only when the users table is empty.
 *
 *   email:    demo@nova.ai
 *   password: Demo12345
 */
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final MemoryRepository memoryRepository;
    private final TaskRepository taskRepository;
    private final NoteRepository noteRepository;
    private final ReminderRepository reminderRepository;
    private final CalendarEventRepository eventRepository;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final NotificationRepository notificationRepository;

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() > 0) {
            return;
        }
        log.info("Seeding NOVA demo account (demo@nova.ai / Demo12345)...");

        User user = userRepository.save(User.builder()
                .email("demo@nova.ai")
                .passwordHash(passwordEncoder.encode("Demo12345"))
                .displayName("Comandante")
                .role(Role.ADMIN)
                .theme("dark")
                .locale("es")
                .persona("NOVA")
                .build());

        memoryRepository.save(MemoryItem.builder().user(user)
                .content("Prefiere comunicacion directa y concisa.")
                .kind(MemoryKind.PREFERENCE).importance(4).source("seed").build());
        memoryRepository.save(MemoryItem.builder().user(user)
                .content("Zona horaria de referencia: Europe/Madrid.")
                .kind(MemoryKind.FACT).importance(3).source("seed").build());

        taskRepository.save(TaskEntity.builder().user(user)
                .title("Explorar el panel de control de NOVA")
                .description("Echa un vistazo al dashboard, el chat y los modulos.")
                .priority(TaskPriority.HIGH).status(TaskStatus.TODO).build());
        taskRepository.save(TaskEntity.builder().user(user)
                .title("Conectar una clave de OpenAI")
                .description("Anade OPENAI_API_KEY en el .env para activar el razonamiento avanzado.")
                .priority(TaskPriority.MEDIUM).status(TaskStatus.TODO).build());

        noteRepository.save(Note.builder().user(user)
                .title("Bienvenida")
                .content("NOVA esta lista. Puedes hablar por voz, gestionar tareas, notas, recordatorios "
                        + "y calendario, y yo recordare lo importante sobre ti.")
                .tags("bienvenida, nova").pinned(true).build());

        reminderRepository.save(Reminder.builder().user(user)
                .title("Probar el asistente por voz")
                .notes("Pulsa el microfono en el chat y hablale a NOVA.")
                .remindAt(Instant.now().plus(Duration.ofDays(1))).build());

        Instant start = Instant.now().plus(Duration.ofHours(2));
        eventRepository.save(CalendarEvent.builder().user(user)
                .title("Demo de NOVA")
                .description("Recorrido por las capacidades del asistente.")
                .location("Online")
                .startAt(start).endAt(start.plus(Duration.ofHours(1)))
                .color("cyan").build());

        Conversation conversation = conversationRepository.save(Conversation.builder()
                .user(user).title("Bienvenida a NOVA").pinned(true).build());
        messageRepository.save(Message.builder().conversation(conversation)
                .role(MessageRole.ASSISTANT)
                .content("Hola, soy NOVA. Estoy operativa y lista para ayudarte. Puedo gestionar tus tareas, "
                        + "notas, recordatorios y calendario, recordar datos importantes y conversar contigo. "
                        + "Para empezar, prueba a pedirme: \"crea una tarea para manana\" o \"recuerda que prefiero el te al cafe\".")
                .tokens(60).build());

        notificationRepository.save(Notification.builder().user(user)
                .type(NotificationType.SYSTEM)
                .title("Bienvenido a NOVA")
                .body("Tu asistente personal esta configurado y listo. Explora el panel de control.")
                .actionUrl("/chat").build());

        log.info("NOVA demo data seeded.");
    }
}
