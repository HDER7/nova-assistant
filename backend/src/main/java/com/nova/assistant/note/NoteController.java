package com.nova.assistant.note;

import com.nova.assistant.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
public class NoteController {

    private final NoteService noteService;

    @GetMapping
    public List<NoteResponse> list(@AuthenticationPrincipal SecurityUser principal) {
        return noteService.list(principal.getId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NoteResponse create(@AuthenticationPrincipal SecurityUser principal,
                               @Valid @RequestBody CreateNoteRequest req) {
        return noteService.create(principal.getId(), req);
    }

    @PatchMapping("/{id}")
    public NoteResponse update(@AuthenticationPrincipal SecurityUser principal,
                               @PathVariable UUID id, @Valid @RequestBody UpdateNoteRequest req) {
        return noteService.update(principal.getId(), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal SecurityUser principal, @PathVariable UUID id) {
        noteService.delete(principal.getId(), id);
    }
}
