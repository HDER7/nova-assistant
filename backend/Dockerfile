# ---- Build stage ----
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -e -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q -e -DskipTests clean package

# ---- Runtime stage ----
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
RUN useradd -r -u 1001 nova && mkdir -p /app/uploads && chown -R nova:nova /app
COPY --from=build /app/target/nova-assistant.jar app.jar
USER nova
EXPOSE 8080
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"
HEALTHCHECK --interval=20s --timeout=4s --start-period=40s --retries=5 \
  CMD wget -qO- http://localhost:${PORT:-8080}/actuator/health | grep -q UP || exit 1
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar app.jar"]
