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
    private Auth auth = new Auth();
    private RateLimit rateLimit = new RateLimit();

    @Getter @Setter
    public static class Auth {
        /** Public sign-up. Off by default: NOVA is a personal assistant. */
        private boolean registrationEnabled = false;
    }

    @Getter @Setter
    public static class RateLimit {
        private boolean enabled = true;
        /** Max auth attempts (login/register/refresh) per IP per minute. */
        private int authPerMinute = 8;
        /** Max AI calls (chat, voice, SOC) per IP per minute. */
        private int aiPerMinute = 30;
    }

    @Getter @Setter
    public static class Models {
        /** Fast model used by the "auto" router for simple turns. */
        private String fast = "openai/gpt-oss-20b";
        /** Strong model used by the "auto" router for complex turns. */
        private String strong = "openai/gpt-oss-120b";
        /** Selector catalog: comma-separated "id|label" pairs. */
        private String catalog = "openai/gpt-oss-120b|GPT-OSS 120B (potente),"
                + "openai/gpt-oss-20b|GPT-OSS 20B (rápido),"
                + "qwen/qwen3.8-27b|Qwen 3.8 27B";
        /** Speech-to-text model. */
        private String whisper = "whisper-large-v3";
    }

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
        private Models models = new Models();
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
        private KevWatch kevWatch = new KevWatch();
    }

    @Getter @Setter
    public static class KevWatch {
        private boolean enabled = true;
        /** Comma-separated vendor/product keywords to alert on; empty = every new KEV entry. */
        private String vendors = "Fortinet,Microsoft,Cisco,Palo Alto,Ivanti,Citrix,VMware,Apache,Linux,Google,Apple,Oracle,SonicWall,Juniper,Atlassian";
    }

    @Getter @Setter
    public static class Virustotal {
        private String apiKey = "";
    }
}
