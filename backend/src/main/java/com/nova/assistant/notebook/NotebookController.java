package com.nova.assistant.notebook;

import com.nova.assistant.notebook.NotebookDtos.*;
import com.nova.assistant.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notebooks")
@RequiredArgsConstructor
public class NotebookController {

    private final NotebookService service;

    @GetMapping
    public List<NotebookSummary> list(@AuthenticationPrincipal SecurityUser p) {
        return service.list(p.getId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NotebookDetail create(@AuthenticationPrincipal SecurityUser p, @Valid @RequestBody CreateNotebook req) {
        return service.create(p.getId(), req);
    }

    @GetMapping("/{id}")
    public NotebookDetail get(@AuthenticationPrincipal SecurityUser p, @PathVariable UUID id) {
        return service.get(p.getId(), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal SecurityUser p, @PathVariable UUID id) {
        service.delete(p.getId(), id);
    }

    @PostMapping(value = "/{id}/sources/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public NotebookDetail addFile(@AuthenticationPrincipal SecurityUser p, @PathVariable UUID id,
                                  @RequestParam("file") MultipartFile file) {
        return service.addFile(p.getId(), id, file);
    }

    @PostMapping("/{id}/sources/text")
    public NotebookDetail addText(@AuthenticationPrincipal SecurityUser p, @PathVariable UUID id,
                                  @Valid @RequestBody TextSource req) {
        return service.addText(p.getId(), id, req);
    }

    @DeleteMapping("/{id}/sources/{sourceId}")
    public NotebookDetail deleteSource(@AuthenticationPrincipal SecurityUser p, @PathVariable UUID id,
                                       @PathVariable UUID sourceId) {
        return service.deleteSource(p.getId(), id, sourceId);
    }

    @PostMapping("/{id}/ask")
    public Answer ask(@AuthenticationPrincipal SecurityUser p, @PathVariable UUID id, @Valid @RequestBody Ask req) {
        return service.ask(p.getId(), id, req);
    }

    @PostMapping("/{id}/audio")
    public NotebookDetail generateAudio(@AuthenticationPrincipal SecurityUser p, @PathVariable UUID id) {
        return service.generateAudio(p.getId(), id);
    }

    @GetMapping("/{id}/audio")
    public ResponseEntity<byte[]> audio(@AuthenticationPrincipal SecurityUser p, @PathVariable UUID id) {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("audio/wav")).body(service.audio(p.getId(), id));
    }
}
