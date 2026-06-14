package com.nova.assistant.memory;

import com.nova.assistant.memory.dto.CreateMemoryRequest;
import com.nova.assistant.memory.dto.MemoryResponse;
import com.nova.assistant.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/memory")
@RequiredArgsConstructor
public class MemoryController {

    private final MemoryService memoryService;

    @GetMapping
    public List<MemoryResponse> list(@AuthenticationPrincipal SecurityUser principal) {
        return memoryService.list(principal.getId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MemoryResponse add(@AuthenticationPrincipal SecurityUser principal,
                              @Valid @RequestBody CreateMemoryRequest req) {
        return memoryService.add(principal.getId(), req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal SecurityUser principal, @PathVariable UUID id) {
        memoryService.delete(principal.getId(), id);
    }
}
