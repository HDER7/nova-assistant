package com.nova.assistant.memory;

import com.nova.assistant.common.ApiException;
import com.nova.assistant.memory.dto.CreateMemoryRequest;
import com.nova.assistant.memory.dto.MemoryResponse;
import com.nova.assistant.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MemoryService {

    private final MemoryRepository memoryRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<MemoryResponse> list(UUID userId) {
        return memoryRepository.findByUser_IdOrderByImportanceDescCreatedAtDesc(userId)
                .stream().map(MemoryResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<String> contextSnippets(UUID userId) {
        return memoryRepository.findTop12ByUser_IdOrderByImportanceDescCreatedAtDesc(userId)
                .stream().map(MemoryItem::getContent).toList();
    }

    @Transactional
    public MemoryResponse add(UUID userId, CreateMemoryRequest req) {
        return MemoryResponse.from(addRaw(userId, req.content(),
                parseKind(req.kind()),
                req.importance() == null ? 3 : req.importance(),
                "manual"));
    }

    @Transactional
    public MemoryItem addRaw(UUID userId, String content, MemoryKind kind, int importance, String source) {
        MemoryItem item = MemoryItem.builder()
                .user(userRepository.getReferenceById(userId))
                .content(content.trim())
                .kind(kind)
                .importance(Math.max(1, Math.min(5, importance)))
                .source(source)
                .build();
        return memoryRepository.save(item);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        MemoryItem item = memoryRepository.findByIdAndUser_Id(id, userId)
                .orElseThrow(() -> ApiException.notFound("Memoria no encontrada"));
        memoryRepository.delete(item);
    }

    private MemoryKind parseKind(String kind) {
        if (kind == null) return MemoryKind.FACT;
        try {
            return MemoryKind.valueOf(kind.toUpperCase());
        } catch (IllegalArgumentException e) {
            return MemoryKind.FACT;
        }
    }
}
