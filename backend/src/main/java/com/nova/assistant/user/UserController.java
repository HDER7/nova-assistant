package com.nova.assistant.user;

import com.nova.assistant.security.SecurityUser;
import com.nova.assistant.user.dto.UpdatePreferencesRequest;
import com.nova.assistant.user.dto.UpdateProfileRequest;
import com.nova.assistant.user.dto.UserResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal SecurityUser principal) {
        return UserResponse.from(userService.getById(principal.getId()));
    }

    @PatchMapping("/me")
    public UserResponse updateProfile(@AuthenticationPrincipal SecurityUser principal,
                                      @Valid @RequestBody UpdateProfileRequest req) {
        return UserResponse.from(userService.updateProfile(principal.getId(), req));
    }

    @PatchMapping("/me/preferences")
    public UserResponse updatePreferences(@AuthenticationPrincipal SecurityUser principal,
                                          @Valid @RequestBody UpdatePreferencesRequest req) {
        return UserResponse.from(userService.updatePreferences(principal.getId(), req));
    }
}
