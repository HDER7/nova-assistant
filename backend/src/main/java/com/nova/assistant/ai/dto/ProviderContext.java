package com.nova.assistant.ai.dto;

import java.util.List;
import java.util.UUID;

public record ProviderContext(UUID conversationId, List<ChatMessage> messages) {}
