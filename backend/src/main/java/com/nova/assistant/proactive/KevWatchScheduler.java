package com.nova.assistant.proactive;

import com.nova.assistant.config.AppProperties;
import com.nova.assistant.notification.NotificationService;
import com.nova.assistant.notification.NotificationType;
import com.nova.assistant.soc.KevService;
import com.nova.assistant.user.User;
import com.nova.assistant.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Watches the CISA KEV catalog and alerts when a newly exploited vulnerability affects a watched vendor
 * ("Señor, ha salido un CVE explotado que afecta a Fortinet"). Each CVE is announced once.
 */
@Component
@RequiredArgsConstructor
public class KevWatchScheduler {

    private static final Logger log = LoggerFactory.getLogger(KevWatchScheduler.class);
    private static final int MAX_ALERTS_PER_RUN = 5;

    private final KevService kevService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbc;
    private final AppProperties properties;

    /** Every 3 hours (first run 2 minutes after boot). */
    @Scheduled(fixedDelayString = "10800000", initialDelayString = "120000")
    public void watch() {
        if (!properties.getSoc().getKevWatch().isEnabled()) return;
        try {
            List<String> vendors = Arrays.stream(properties.getSoc().getKevWatch().getVendors().split(","))
                    .map(v -> v.trim().toLowerCase(Locale.ROOT)).filter(v -> !v.isEmpty()).toList();
            int sent = 0;
            for (KevService.KevEntry e : kevService.recent(2, null)) {
                if (sent >= MAX_ALERTS_PER_RUN) break;
                String haystack = (e.vendor() + " " + e.product()).toLowerCase(Locale.ROOT);
                if (!vendors.isEmpty() && vendors.stream().noneMatch(haystack::contains)) continue;
                // Insert-if-absent: only the first time this CVE is seen produces an alert.
                int inserted = jdbc.update("INSERT INTO kev_alerts (cve_id) VALUES (?) ON CONFLICT DO NOTHING", e.cveId());
                if (inserted == 0) continue;
                String title = "CVE explotado: " + e.cveId() + " (" + e.vendor() + " " + e.product() + ")";
                String body = e.name() + (e.ransomware() ? ". Usado en campañas de ransomware." : ".")
                        + (e.requiredAction().isBlank() ? "" : " Acción: " + e.requiredAction());
                for (User u : userRepository.findAll()) {
                    notificationService.push(u.getId(), NotificationType.ALERT, title,
                            body.length() > 480 ? body.substring(0, 480) + "…" : body, "/soc");
                }
                sent++;
            }
            if (sent > 0) log.info("KEV watch: {} new exploited-vulnerability alert(s)", sent);
        } catch (Exception ex) {
            log.warn("KEV watch failed: {}", ex.toString());
        }
    }
}
