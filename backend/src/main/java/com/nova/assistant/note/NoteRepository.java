package com.nova.assistant.note;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NoteRepository extends JpaRepository<Note, UUID> {
    List<Note> findByUser_IdOrderByPinnedDescUpdatedAtDesc(UUID userId);
    Optional<Note> findByIdAndUser_Id(UUID id, UUID userId);
    long countByUser_Id(UUID userId);
}
