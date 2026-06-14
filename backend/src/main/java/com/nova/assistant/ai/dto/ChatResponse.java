package com.nova.assistant.ai.dto;

import com.nova.assistant.conversation.dto.MessageResponse;

import java.util.UUID;

public record ChatResponse(UUID conversationId, MessageResponse message) {}
