package com.nova.assistant;

import com.nova.assistant.config.AppProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class NovaApplication {
    public static void main(String[] args) {
        SpringApplication.run(NovaApplication.class, args);
    }
}
