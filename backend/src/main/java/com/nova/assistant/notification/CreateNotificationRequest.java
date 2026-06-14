package com.nova.assistant.notification;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateNotificationRequest(
        String type,
        @NotBlank @Size(max = 255) String title,
        String body,
        String actionUrl
) {}
