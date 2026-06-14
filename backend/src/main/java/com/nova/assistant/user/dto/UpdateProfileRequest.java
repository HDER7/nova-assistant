package com.nova.assistant.user.dto;

import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(min = 1, max = 120) String displayName,
        @Size(max = 512) String avatarUrl
) {}
