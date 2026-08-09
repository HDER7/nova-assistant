package com.nova.assistant.soc;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReportRequest(String title, @NotBlank @Size(max = 60000) String content) {}
