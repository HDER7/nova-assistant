package com.nova.assistant.auth;

import com.nova.assistant.auth.dto.*;
import com.nova.assistant.common.ApiException;
import com.nova.assistant.security.JwtService;
import com.nova.assistant.user.Role;
import com.nova.assistant.user.User;
import com.nova.assistant.user.UserRepository;
import com.nova.assistant.user.dto.UserResponse;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmailIgnoreCase(req.email())) {
            throw ApiException.conflict("Ya existe una cuenta con ese correo");
        }
        User user = User.builder()
                .email(req.email().toLowerCase().trim())
                .passwordHash(passwordEncoder.encode(req.password()))
                .displayName(req.displayName().trim())
                .role(Role.USER)
                .theme("dark")
                .locale("es")
                .persona("NOVA")
                .build();
        user = userRepository.save(user);
        return tokens(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmailIgnoreCase(req.email())
                .orElseThrow(() -> ApiException.unauthorized("Credenciales invalidas"));
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw ApiException.unauthorized("Credenciales invalidas");
        }
        return tokens(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse refresh(RefreshRequest req) {
        final Claims claims;
        try {
            claims = jwtService.parse(req.refreshToken());
        } catch (Exception e) {
            throw ApiException.unauthorized("Token de actualizacion invalido");
        }
        if (!jwtService.isRefresh(claims)) {
            throw ApiException.unauthorized("Token de actualizacion invalido");
        }
        User user = userRepository.findById(UUID.fromString(claims.getSubject()))
                .orElseThrow(() -> ApiException.unauthorized("Usuario no encontrado"));
        return tokens(user);
    }

    private AuthResponse tokens(User user) {
        return new AuthResponse(
                jwtService.generateAccessToken(user),
                jwtService.generateRefreshToken(user),
                "Bearer",
                jwtService.accessTtlSeconds(),
                UserResponse.from(user));
    }
}
