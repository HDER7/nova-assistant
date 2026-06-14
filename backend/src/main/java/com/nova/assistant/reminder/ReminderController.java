package com.nova.assistant.reminder;

import com.nova.assistant.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reminders")
@RequiredArgsConstructor
public class ReminderController {

    private final ReminderService reminderService;

    @GetMapping
    public List<ReminderResponse> list(@AuthenticationPrincipal SecurityUser principal) {
        return reminderService.list(principal.getId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReminderResponse create(@AuthenticationPrincipal SecurityUser principal,
                                   @Valid @RequestBody CreateReminderRequest req) {
        return reminderService.create(principal.getId(), req);
    }

    @PatchMapping("/{id}")
    public ReminderResponse update(@AuthenticationPrincipal SecurityUser principal,
                                   @PathVariable UUID id, @Valid @RequestBody UpdateReminderRequest req) {
        return reminderService.update(principal.getId(), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal SecurityUser principal, @PathVariable UUID id) {
        reminderService.delete(principal.getId(), id);
    }
}
