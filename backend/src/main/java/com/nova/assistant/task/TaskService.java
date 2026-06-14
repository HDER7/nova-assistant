package com.nova.assistant.task;

import com.nova.assistant.common.ApiException;
import com.nova.assistant.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<TaskResponse> list(UUID userId, String status) {
        List<TaskEntity> tasks = (status == null || status.isBlank())
                ? taskRepository.findByUser_IdOrderByCreatedAtDesc(userId)
                : taskRepository.findByUser_IdAndStatusOrderByCreatedAtDesc(userId, parseStatus(status));
        return tasks.stream().map(TaskResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Long> stats(UUID userId) {
        return Map.of(
                "total", taskRepository.countByUser_Id(userId),
                "todo", taskRepository.countByUser_IdAndStatus(userId, TaskStatus.TODO),
                "inProgress", taskRepository.countByUser_IdAndStatus(userId, TaskStatus.IN_PROGRESS),
                "done", taskRepository.countByUser_IdAndStatus(userId, TaskStatus.DONE));
    }

    @Transactional
    public TaskResponse create(UUID userId, CreateTaskRequest req) {
        TaskEntity task = TaskEntity.builder()
                .user(userRepository.getReferenceById(userId))
                .title(req.title().trim())
                .description(req.description())
                .priority(parsePriority(req.priority()))
                .dueAt(req.dueAt())
                .status(TaskStatus.TODO)
                .build();
        return TaskResponse.from(taskRepository.save(task));
    }

    @Transactional
    public TaskResponse update(UUID userId, UUID id, UpdateTaskRequest req) {
        TaskEntity task = owned(userId, id);
        if (req.title() != null && !req.title().isBlank()) task.setTitle(req.title().trim());
        if (req.description() != null) task.setDescription(req.description());
        if (req.priority() != null) task.setPriority(parsePriority(req.priority()));
        if (req.dueAt() != null) task.setDueAt(req.dueAt());
        if (req.status() != null) {
            TaskStatus status = parseStatus(req.status());
            task.setStatus(status);
            task.setCompletedAt(status == TaskStatus.DONE ? Instant.now() : null);
        }
        return TaskResponse.from(taskRepository.save(task));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        taskRepository.delete(owned(userId, id));
    }

    private TaskEntity owned(UUID userId, UUID id) {
        return taskRepository.findByIdAndUser_Id(id, userId)
                .orElseThrow(() -> ApiException.notFound("Tarea no encontrada"));
    }

    private TaskStatus parseStatus(String s) {
        try { return TaskStatus.valueOf(s.toUpperCase()); }
        catch (Exception e) { throw ApiException.badRequest("Estado de tarea invalido: " + s); }
    }

    private TaskPriority parsePriority(String s) {
        if (s == null || s.isBlank()) return TaskPriority.MEDIUM;
        try { return TaskPriority.valueOf(s.toUpperCase()); }
        catch (Exception e) { return TaskPriority.MEDIUM; }
    }
}
