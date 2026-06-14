package com.nova.assistant.note;

import com.nova.assistant.common.ApiException;
import com.nova.assistant.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NoteService {

    private final NoteRepository noteRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<NoteResponse> list(UUID userId) {
        return noteRepository.findByUser_IdOrderByPinnedDescUpdatedAtDesc(userId)
                .stream().map(NoteResponse::from).toList();
    }

    @Transactional
    public NoteResponse create(UUID userId, CreateNoteRequest req) {
        Note note = Note.builder()
                .user(userRepository.getReferenceById(userId))
                .title(req.title() == null || req.title().isBlank() ? "Nota" : req.title().trim())
                .content(req.content() == null ? "" : req.content())
                .tags(joinTags(req.tags()))
                .build();
        return NoteResponse.from(noteRepository.save(note));
    }

    @Transactional
    public NoteResponse update(UUID userId, UUID id, UpdateNoteRequest req) {
        Note note = owned(userId, id);
        if (req.title() != null && !req.title().isBlank()) note.setTitle(req.title().trim());
        if (req.content() != null) note.setContent(req.content());
        if (req.tags() != null) note.setTags(joinTags(req.tags()));
        if (req.pinned() != null) note.setPinned(req.pinned());
        return NoteResponse.from(noteRepository.save(note));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        noteRepository.delete(owned(userId, id));
    }

    private Note owned(UUID userId, UUID id) {
        return noteRepository.findByIdAndUser_Id(id, userId)
                .orElseThrow(() -> ApiException.notFound("Nota no encontrada"));
    }

    private String joinTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) return "";
        return String.join(", ", tags.stream().map(String::trim).filter(s -> !s.isEmpty()).toList());
    }
}
