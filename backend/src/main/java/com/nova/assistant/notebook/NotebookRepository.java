package com.nova.assistant.notebook;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotebookRepository extends JpaRepository<Notebook, UUID> {
    List<Notebook> findByUser_IdOrderByUpdatedAtDesc(UUID userId);
    Optional<Notebook> findByIdAndUser_Id(UUID id, UUID userId);
}
