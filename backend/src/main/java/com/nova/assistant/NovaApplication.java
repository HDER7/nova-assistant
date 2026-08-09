package com.nova.assistant;

import com.nova.assistant.config.AppProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
@EnableScheduling
public class NovaApplication {
    public static void main(String[] args) {
        SpringApplication.run(NovaApplication.class, args);
    }
}
