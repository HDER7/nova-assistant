package com.nova.assistant.memory;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MemoryRepository extends JpaRepository<MemoryItem, UUID> {
    List<MemoryItem> findByUser_IdOrderByImportanceDescCreatedAtDesc(UUID userId);
    List<MemoryItem> findTop12ByUser_IdOrderByImportanceDescCreatedAtDesc(UUID userId);
    Optional<MemoryItem> findByIdAndUser_Id(UUID id, UUID userId);
    long countByUser_Id(UUID userId);
}
