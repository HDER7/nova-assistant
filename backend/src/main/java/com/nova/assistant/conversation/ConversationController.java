package com.nova.assistant.conversation;

import com.nova.assistant.conversation.dto.*;
import com.nova.assistant.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;

    @GetMapping
    public List<ConversationResponse> list(@AuthenticationPrincipal SecurityUser principal) {
        return conversationService.list(principal.getId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationResponse create(@AuthenticationPrincipal SecurityUser principal,
                                       @Valid @RequestBody(required = false) CreateConversationRequest req) {
        return conversationService.create(principal.getId(), req);
    }

    @GetMapping("/{id}")
    public ConversationResponse get(@AuthenticationPrincipal SecurityUser principal, @PathVariable UUID id) {
        return conversationService.get(id, principal.getId());
    }

    @GetMapping("/{id}/messages")
    public List<MessageResponse> messages(@AuthenticationPrincipal SecurityUser principal, @PathVariable UUID id) {
        return conversationService.messages(id, principal.getId());
    }

    @PatchMapping("/{id}")
    public ConversationResponse update(@AuthenticationPrincipal SecurityUser principal,
                                       @PathVariable UUID id,
                                       @Valid @RequestBody UpdateConversationRequest req) {
        return conversationService.update(id, principal.getId(), req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal SecurityUser principal, @PathVariable UUID id) {
        conversationService.delete(id, principal.getId());
    }
}
