package com.nova.assistant.user.dto;

import com.nova.assistant.user.User;

import java.time.Instant;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String displayName,
        String role,
        String avatarUrl,
        String theme,
        String locale,
        String persona,
        Instant createdAt
) {
    public static UserResponse from(User u) {
        return new UserResponse(
                u.getId(), u.getEmail(), u.getDisplayName(), u.getRole().name(),
                u.getAvatarUrl(), u.getTheme(), u.getLocale(), u.getPersona(), u.getCreatedAt());
    }
}
