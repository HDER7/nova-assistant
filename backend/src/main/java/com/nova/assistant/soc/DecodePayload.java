package com.nova.assistant.soc;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DecodePayload(@NotBlank @Size(max = 20000) String input, String mode) {}
