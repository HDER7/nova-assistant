package com.nova.assistant.config;

import com.nova.assistant.ai.AiProvider;
import com.nova.assistant.ai.MockAiProvider;
import com.nova.assistant.ai.OpenAiProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.web.client.RestClient;

@Configuration
public class AiConfig {

    private static final Logger log = LoggerFactory.getLogger(AiConfig.class);

    /**
     * Selects the active AI provider at startup:
     *  - "openai" + a non-empty API key  -> live OpenAI provider
     *  - anything else                    -> offline mock brain (zero-config)
     */
    @Bean
    @Primary
    public AiProvider primaryAiProvider(AppProperties props, RestClient.Builder builder, MockAiProvider mock) {
        AppProperties.Ai ai = props.getAi();
        boolean wantsOpenAi = "openai".equalsIgnoreCase(ai.getProvider());
        boolean hasKey = ai.getOpenai().getApiKey() != null && !ai.getOpenai().getApiKey().isBlank();
        if (wantsOpenAi && hasKey) {
            log.info("NOVA AI provider: OpenAI ({})", ai.getOpenai().getModel());
            return new OpenAiProvider(builder, ai.getOpenai());
        }
        log.warn("NOVA AI provider: offline mock brain (set NOVA_AI_OPENAI_API_KEY to enable OpenAI).");
        return mock;
    }
}
