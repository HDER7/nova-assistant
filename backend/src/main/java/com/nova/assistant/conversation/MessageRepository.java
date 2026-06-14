package com.nova.assistant.conversation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {
    List<Message> findByConversation_IdOrderByCreatedAtAsc(UUID conversationId);
    List<Message> findTop20ByConversation_IdOrderByCreatedAtDesc(UUID conversationId);
    long countByConversation_Id(UUID conversationId);
}
