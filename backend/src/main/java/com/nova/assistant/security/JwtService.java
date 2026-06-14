package com.nova.assistant.security;

import com.nova.assistant.config.AppProperties;
import com.nova.assistant.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

@Service
public class JwtService {

    private final AppProperties properties;
    private final SecretKey key;

    public JwtService(AppProperties properties) {
        this.properties = properties;
        this.key = Keys.hmacShaKeyFor(properties.getJwt().getSecret().getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(User user) {
        return build(user, "access", Duration.ofMinutes(properties.getJwt().getAccessTtlMinutes()));
    }

    public String generateRefreshToken(User user) {
        return build(user, "refresh", Duration.ofDays(properties.getJwt().getRefreshTtlDays()));
    }

    public long accessTtlSeconds() {
        return Duration.ofMinutes(properties.getJwt().getAccessTtlMinutes()).toSeconds();
    }

    private String build(User user, String type, Duration ttl) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.getId().toString())
                .claim("type", type)
                .claim("email", user.getEmail())
                .claim("role", user.getRole().name())
                .issuer(properties.getJwt().getIssuer())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean isAccess(Claims claims) {
        return "access".equals(claims.get("type"));
    }

    public boolean isRefresh(Claims claims) {
        return "refresh".equals(claims.get("type"));
    }
}
