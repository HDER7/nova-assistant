package com.nova.assistant.protocol;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProtocolRequest(
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Size(max = 4000) String steps
) {}
