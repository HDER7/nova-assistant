package com.nova.assistant.memory.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateMemoryRequest(
        @NotBlank @Size(max = 2000) String content,
        String kind,
        @Min(1) @Max(5) Integer importance
) {}
