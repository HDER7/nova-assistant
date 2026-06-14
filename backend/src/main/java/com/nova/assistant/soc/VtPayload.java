package com.nova.assistant.soc;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VtPayload(@NotBlank @Size(max = 2048) String indicator) {}
