package com.nova.assistant.ai;

import com.nova.assistant.ai.dto.ChatMessage;

import java.util.List;

public interface AiProvider {

    /** Human-readable identifier, e.g. "openai:gpt-4o-mini" or "mock". */
    String name();

    /** True when backed by a real remote model (vs. the offline brain). */
    boolean live();

    /** Produce a single assistant completion for the given message history. */
    String complete(List<ChatMessage> messages, double temperature, int maxTokens);
}
