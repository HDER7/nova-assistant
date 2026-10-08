package com.nova.assistant.notebook;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Request/response records for the notebooks module. */
public final class NotebookDtos {
    private NotebookDtos() { }

    public record CreateNotebook(@NotBlank @Size(max = 160) String title) { }

    public record TextSource(@NotBlank @Size(max = 200) String title, @NotBlank @Size(max = 200_000) String content) { }

    public record Turn(String role, String content) { }

    public record Ask(@NotBlank @Size(max = 4000) String question, List<Turn> history) { }

    public record SourceInfo(UUID id, String title, String kind, int chars, String preview, Instant createdAt) { }

    public record NotebookSummary(UUID id, String title, long sources, Instant updatedAt, boolean hasAudio) { }

    public record NotebookDetail(UUID id, String title, List<SourceInfo> sources, int totalChars,
                                 boolean hasAudio, String audioTitle, Instant audioAt) { }

    public record Citation(int index, String title) { }

    public record Answer(String answer, List<Citation> citations) { }
}
