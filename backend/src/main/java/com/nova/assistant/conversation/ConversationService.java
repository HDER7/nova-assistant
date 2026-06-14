package com.nova.assistant.conversation;

import com.nova.assistant.common.ApiException;
import com.nova.assistant.conversation.dto.*;
import com.nova.assistant.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<ConversationResponse> list(UUID userId) {
        return conversationRepository.findByUser_IdOrderByPinnedDescUpdatedAtDesc(userId)
                .stream().map(ConversationResponse::from).toList();
    }

    @Transactional
    public Conversation createEntity(UUID userId, String title) {
        Conversation c = Conversation.builder()
                .user(userRepository.getReferenceById(userId))
                .title(title == null || title.isBlank() ? "Nueva conversacion" : title.trim())
                .build();
        return conversationRepository.save(c);
    }

    @Transactional
    public ConversationResponse create(UUID userId, CreateConversationRequest req) {
        return ConversationResponse.from(createEntity(userId, req == null ? null : req.title()));
    }

    @Transactional(readOnly = true)
    public Conversation getOwned(UUID id, UUID userId) {
        return conversationRepository.findByIdAndUser_Id(id, userId)
                .orElseThrow(() -> ApiException.notFound("Conversacion no encontrada"));
    }

    @Transactional(readOnly = true)
    public ConversationResponse get(UUID id, UUID userId) {
        return ConversationResponse.from(getOwned(id, userId));
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> messages(UUID id, UUID userId) {
        getOwned(id, userId);
        return messageRepository.findByConversation_IdOrderByCreatedAtAsc(id)
                .stream().map(MessageResponse::from).toList();
    }

    @Transactional
    public ConversationResponse update(UUID id, UUID userId, UpdateConversationRequest req) {
        Conversation c = getOwned(id, userId);
        if (req.title() != null && !req.title().isBlank()) {
            c.setTitle(req.title().trim());
        }
        if (req.pinned() != null) {
            c.setPinned(req.pinned());
        }
        return ConversationResponse.from(conversationRepository.save(c));
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        Conversation c = getOwned(id, userId);
        conversationRepository.delete(c);
    }
}
