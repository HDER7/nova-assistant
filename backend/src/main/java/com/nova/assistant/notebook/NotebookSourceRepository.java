package com.nova.assistant.notebook;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotebookSourceRepository extends JpaRepository<NotebookSource, UUID> {
    List<NotebookSource> findByNotebook_IdOrderByCreatedAtAsc(UUID notebookId);
    Optional<NotebookSource> findByIdAndNotebook_Id(UUID id, UUID notebookId);
    long countByNotebook_Id(UUID notebookId);
}
