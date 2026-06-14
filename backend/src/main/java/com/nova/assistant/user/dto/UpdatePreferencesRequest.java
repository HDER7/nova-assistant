package com.nova.assistant.user.dto;

import jakarta.validation.constraints.Size;

public record UpdatePreferencesRequest(
        @Size(max = 20) String theme,
        @Size(max = 10) String locale,
        @Size(max = 40) String persona
) {}
