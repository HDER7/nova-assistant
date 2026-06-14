package com.nova.assistant.task;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TaskRepository extends JpaRepository<TaskEntity, UUID> {
    List<TaskEntity> findByUser_IdOrderByCreatedAtDesc(UUID userId);
    List<TaskEntity> findByUser_IdAndStatusOrderByCreatedAtDesc(UUID userId, TaskStatus status);
    Optional<TaskEntity> findByIdAndUser_Id(UUID id, UUID userId);
    long countByUser_IdAndStatus(UUID userId, TaskStatus status);
    long countByUser_Id(UUID userId);
}
