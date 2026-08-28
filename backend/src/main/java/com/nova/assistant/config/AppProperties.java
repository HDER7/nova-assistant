package com.nova.assistant.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "nova")
public class AppProperties {

    private Jwt jwt = new Jwt();
    private Ai ai = new Ai();
    private Cors cors = new Cors();
    private Upload upload = new Upload();
    private Search search = new Search();
    private Soc soc = new Soc();

    @Getter @Setter
    public static class Jwt {
        private String secret = "change_me_to_a_long_random_64_char_secret_value_please_now_0000";
        private long accessTtlMinutes = 30;
        private long refreshTtlDays = 14;
        private String issuer = "nova-assistant";
    }

    @Getter @Setter
    public static class Ai {
        private String provider = "openai";
        private OpenAi openai = new OpenAi();
        /** Optional local brain: an OpenAI-compatible server such as OpenJarvis (`jarvis serve`) or Ollama. */
        private Local local = new Local();
    }

    @Getter @Setter
    public static class OpenAi {
        private String apiKey = "";
        private String model = "gpt-4o-mini";
        private String baseUrl = "https://api.openai.com/v1";
        private double temperature = 0.6;
        private int maxTokens = 1024;
    }

    @Getter @Setter
    public static class Local {
        /** When true, NOVA offers a "Local (OpenJarvis)" engine that routes inference to baseUrl. */
        private boolean enabled = true;
        /** OpenAI-compatible endpoint. OpenJarvis default: http://localhost:8000/v1 ; Ollama: http://localhost:11434/v1 */
        private String baseUrl = "http://localhost:8000/v1";
        /** Model id to request; empty lets OpenJarvis pick the best local model for the hardware. */
        private String model = "";
        /** Bearer token; OpenJarvis/Ollama ignore it but the header must be present. */
        private String apiKey = "local";
        private String label = "Local (OpenJarvis)";
    }

    @Getter @Setter
    public static class Cors {
        private String allowedOrigins = "http://localhost:3000";
    }

    @Getter @Setter
    public static class Upload {
        private String dir = "uploads";
    }

    @Getter @Setter
    public static class Search {
        private boolean enabled = true;
        private String endpoint = "https://api.duckduckgo.com/";
    }

    @Getter @Setter
    public static class Soc {
        private Virustotal virustotal = new Virustotal();
    }

    @Getter @Setter
    public static class Virustotal {
        private String apiKey = "";
    }
}
