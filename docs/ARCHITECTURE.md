# NOVA · Arquitectura técnica

## Visión general

NOVA es una aplicación web full-stack de dos servicios principales (frontend y backend)
apoyados en PostgreSQL y Redis. La comunicación es vía REST/JSON y **Server-Sent Events
(SSE)** para el streaming del chat. La autenticación es *stateless* mediante JWT.

```
Navegador ──▶ Next.js (SSR/CSR) ──▶ Spring Boot REST/SSE ──▶ PostgreSQL
                                            │
                                            ├──▶ Redis (caché)
                                            └──▶ OpenAI API (opcional)
```

## Backend (Spring Boot 3 · Java 17)

Organización **por dominio** (package-by-feature). Cada módulo contiene su entidad JPA,
repositorio Spring Data, servicio transaccional, controlador REST y DTOs (records).

| Módulo          | Responsabilidad                                                        |
|-----------------|------------------------------------------------------------------------|
| `auth`          | Registro, login, refresh. Emite JWT access/refresh.                    |
| `user`          | Perfil y preferencias (tema, idioma, persona).                         |
| `security`      | Filtro JWT, `UserDetails`, configuración de Spring Security.           |
| `conversation`  | Conversaciones y mensajes.                                             |
| `ai`            | Proveedores de IA, orquestación del chat, streaming SSE.               |
| `memory`        | Memoria persistente del usuario.                                       |
| `task`          | Tareas (estado + prioridad).                                           |
| `note`          | Notas con etiquetas.                                                   |
| `reminder`      | Recordatorios con recurrencia.                                         |
| `calendar`      | Eventos de calendario.                                                 |
| `notification`  | Notificaciones in-app.                                                 |
| `search`        | Búsqueda web (DuckDuckGo Instant Answer).                              |
| `document`      | Extracción de texto (PDFBox) + análisis con IA.                        |
| `dashboard`     | Agregación de métricas para el panel.                                  |
| `common/config` | Manejo global de errores, propiedades, OpenAPI, *seeder*.             |

### Capa de IA (pluggable)

```
            ┌───────────────────────────────┐
ChatService │  AiService                    │
            │   ├─ provider: AiProvider  ◀── @Primary (elegido en arranque)
            │   └─ fallback: MockAiProvider │
            └──────────────┬────────────────┘
                           │ implements
        ┌──────────────────┴───────────────────┐
        ▼                                       ▼
  OpenAiProvider (RestClient → /chat/...)   MockAiProvider (offline, determinista)
```

`AiConfig` selecciona el proveedor en el arranque: si `AI_PROVIDER=openai` y hay
`OPENAI_API_KEY`, se usa OpenAI; en caso contrario, el cerebro local. Además, si una
llamada en vivo falla (red, cuota, clave inválida), `AiService` **degrada con elegancia**
al `MockAiProvider`. El `OpenAiProvider` apunta a `OPENAI_BASE_URL`, por lo que es
compatible con Azure OpenAI, Ollama (`/v1`) y LM Studio.

### Flujo de un turno de chat (streaming)

1. `POST /api/chat/stream` con `{ conversationId?, message }` y `Authorization: Bearer`.
2. `AiPersistence.prepareUserTurn` (transaccional) crea la conversación si hace falta,
   guarda el mensaje del usuario y **ensambla el contexto**: prompt de sistema (persona
   NOVA) + memoria del usuario (top-12 por importancia) + últimos 20 mensajes.
3. Se emite el evento SSE `meta` con el `conversationId`.
4. El proveedor genera la respuesta; se emite token a token como eventos `token`.
5. `AiPersistence.finishAssistantTurn` guarda la respuesta, actualiza el título de la
   conversación en el primer turno y **extrae memoria** ("recuerda que…", "me llamo…").
6. Se emite `done` con el mensaje final.

> Las transacciones se aíslan en `AiPersistence` (un bean distinto de `AiService`) para
> evitar el problema de auto-invocación de `@Transactional` durante el streaming asíncrono.

### Modelo de datos

`users 1—N conversations 1—N messages`, y `users 1—N {memory_items, tasks, notes,
reminders, calendar_events, notifications}`. Claves primarias **UUID**; marcas de tiempo
en **UTC** (`timestamptz`). El esquema se gestiona con **Flyway** (`V1__init.sql`);
Hibernate usa `ddl-auto: none` (la base de datos es la fuente de verdad). Borrado en
cascada por usuario (`ON DELETE CASCADE`).

### Seguridad

- `BCrypt` para contraseñas; `JwtService` firma con HMAC (clave de `JWT_SECRET`).
- `JwtAuthenticationFilter` valida el *access token* y puebla el `SecurityContext`.
- Sesiones *stateless*; rutas públicas: `/api/auth/**`, `/actuator/health`, Swagger.
- Aislamiento por propietario: todas las consultas filtran por `user_id`.

## Frontend (Next.js 14 · App Router)

- **Rutas**: grupo `(auth)` (login/registro) y grupo `(dashboard)` protegido por un
  *guard* de cliente que comprueba el token hidratado.
- **Estado**: Zustand. `authStore` (persistido en `localStorage`: usuario + tokens) y
  `uiStore` (toasts). El tema se gestiona en `ThemeProvider` (clase `.dark`).
- **Cliente API** (`lib/api.ts`): wrapper `fetch` con `Authorization`, **refresh
  automático** del token ante un `401` y reintento, más `streamChat` que lee el cuerpo
  SSE con `ReadableStream` y despacha `meta/token/done`.
- **Voz** (`lib/speech.ts`): `SpeechRecognition` (STT) y `speechSynthesis` (TTS).
- **UI**: Tailwind con variables CSS (tema claro/oscuro), animaciones (arc-reactor,
  *scan*, *fade-up*), componentes reutilizables y diseño responsive.

## Decisiones de diseño

- **SSE en lugar de WebSocket** para el chat: más simple, compatible con HTTP/proxies y
  suficiente para streaming unidireccional servidor→cliente.
- **Records de Java** para DTOs: inmutables y concisos.
- **Redis** integrado para caché/escala; no está en la ruta crítica (el sistema arranca
  aunque Redis no esté disponible).
- **Cerebro local** para que el producto sea ejecutable y demostrable sin coste ni claves.
