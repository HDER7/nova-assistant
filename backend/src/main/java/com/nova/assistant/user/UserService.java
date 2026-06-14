package com.nova.assistant.user;

import com.nova.assistant.common.ApiException;
import com.nova.assistant.user.dto.UpdatePreferencesRequest;
import com.nova.assistant.user.dto.UpdateProfileRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public User getById(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Usuario no encontrado"));
    }

    @Transactional
    public User updateProfile(UUID id, UpdateProfileRequest req) {
        User user = getById(id);
        if (req.displayName() != null && !req.displayName().isBlank()) {
            user.setDisplayName(req.displayName().trim());
        }
        if (req.avatarUrl() != null) {
            user.setAvatarUrl(req.avatarUrl().isBlank() ? null : req.avatarUrl().trim());
        }
        return userRepository.save(user);
    }

    @Transactional
    public User updatePreferences(UUID id, UpdatePreferencesRequest req) {
        User user = getById(id);
        if (req.theme() != null && !req.theme().isBlank()) {
            user.setTheme(req.theme().trim());
        }
        if (req.locale() != null && !req.locale().isBlank()) {
            user.setLocale(req.locale().trim());
        }
        if (req.persona() != null && !req.persona().isBlank()) {
            user.setPersona(req.persona().trim());
        }
        return userRepository.save(user);
    }
}
