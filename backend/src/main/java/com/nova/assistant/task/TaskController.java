package com.nova.assistant.task;

import com.nova.assistant.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @GetMapping
    public List<TaskResponse> list(@AuthenticationPrincipal SecurityUser principal,
                                   @RequestParam(required = false) String status) {
        return taskService.list(principal.getId(), status);
    }

    @GetMapping("/stats")
    public Map<String, Long> stats(@AuthenticationPrincipal SecurityUser principal) {
        return taskService.stats(principal.getId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse create(@AuthenticationPrincipal SecurityUser principal,
                               @Valid @RequestBody CreateTaskRequest req) {
        return taskService.create(principal.getId(), req);
    }

    @PatchMapping("/{id}")
    public TaskResponse update(@AuthenticationPrincipal SecurityUser principal,
                               @PathVariable UUID id, @Valid @RequestBody UpdateTaskRequest req) {
        return taskService.update(principal.getId(), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal SecurityUser principal, @PathVariable UUID id) {
        taskService.delete(principal.getId(), id);
    }
}
