package com.nova.assistant.protocol;

import com.nova.assistant.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/protocols")
@RequiredArgsConstructor
public class ProtocolController {

    private final ProtocolService protocolService;

    @GetMapping
    public List<ProtocolResponse> list(@AuthenticationPrincipal SecurityUser principal) {
        return protocolService.list(principal.getId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProtocolResponse create(@AuthenticationPrincipal SecurityUser principal, @Valid @RequestBody ProtocolRequest req) {
        return protocolService.create(principal.getId(), req);
    }

    @PutMapping("/{id}")
    public ProtocolResponse update(@AuthenticationPrincipal SecurityUser principal, @PathVariable UUID id,
                                   @Valid @RequestBody ProtocolRequest req) {
        return protocolService.update(principal.getId(), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal SecurityUser principal, @PathVariable UUID id) {
        protocolService.delete(principal.getId(), id);
    }
}
