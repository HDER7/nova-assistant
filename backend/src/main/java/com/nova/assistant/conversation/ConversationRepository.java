package com.nova.assistant.conversation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {
    List<Conversation> findByUser_IdOrderByPinnedDescUpdatedAtDesc(UUID userId);
    Optional<Conversation> findByIdAndUser_Id(UUID id, UUID userId);
    long countByUser_Id(UUID userId);
}
