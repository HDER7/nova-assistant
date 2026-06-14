package com.nova.assistant.ai.dto;

/** A single message handed to an AI provider. role = system | user | assistant. */
public record ChatMessage(String role, String content) {}
