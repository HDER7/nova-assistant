package com.nova.assistant.security;

import com.nova.assistant.config.AppProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sliding-window rate limiter (per client IP, per bucket), in memory.
 * Protects login against brute force and the AI endpoints against quota abuse.
 * Registered inside the Spring Security chain (after CORS) so 429s keep CORS headers.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MS = 60_000L;
    private static final int MAX_KEYS = 10_000;

    private final AppProperties properties;
    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    public RateLimitFilter(AppProperties properties) {
        this.properties = properties;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        AppProperties.RateLimit cfg = properties.getRateLimit();
        if (!cfg.isEnabled() || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }
        String path = request.getRequestURI();
        String bucket;
        int limit;
        if (path.startsWith("/api/auth/")) {
            bucket = "auth";
            limit = cfg.getAuthPerMinute();
        } else if (path.startsWith("/api/voice/speak")) {
            // One answer is spoken in a few chunks: give the voice its own, larger budget.
            bucket = "tts";
            limit = cfg.getAiPerMinute() * 3;
        } else if (isAiPath(path, request.getMethod())) {
            bucket = "ai";
            limit = cfg.getAiPerMinute();
        } else {
            chain.doFilter(request, response);
            return;
        }

        if (limit <= 0) {
            chain.doFilter(request, response);
            return;
        }
        String key = bucket + ":" + clientIp(request);
        long now = System.currentTimeMillis();
        if (hits.size() > MAX_KEYS) prune(now);
        Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        long retryAfterSec;
        synchronized (q) {
            while (!q.isEmpty() && now - q.peekFirst() > WINDOW_MS) q.pollFirst();
            if (q.size() >= limit) {
                retryAfterSec = Math.max(1, (WINDOW_MS - (now - q.peekFirst())) / 1000);
            } else {
                q.addLast(now);
                retryAfterSec = 0;
            }
        }
        if (retryAfterSec > 0) {
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfterSec));
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"status\":429,\"error\":\"Too Many Requests\",\"message\":"
                    + "\"Demasiadas solicitudes. Intenta de nuevo en " + retryAfterSec + " s.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isAiPath(String path, String method) {
        if (!"POST".equalsIgnoreCase(method)) return false;
        return path.startsWith("/api/chat") || path.startsWith("/api/voice") || path.startsWith("/api/soc")
                || path.startsWith("/api/live")
                || (path.startsWith("/api/notebooks") && (path.endsWith("/ask") || path.endsWith("/audio")));
    }

    private String clientIp(HttpServletRequest request) {
        // Render / Vercel sit behind a proxy: first X-Forwarded-For entry is the real client.
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }

    private void prune(long now) {
        hits.entrySet().removeIf(e -> {
            Deque<Long> q = e.getValue();
            synchronized (q) {
                return q.isEmpty() || now - q.peekLast() > WINDOW_MS;
            }
        });
    }
}
