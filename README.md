<div align="center">

# 🛰️ NOVA — Asistente Virtual Avanzado

**Neural Orchestrated Virtual Assistant** · Inspirado en JARVIS, con identidad propia.

IA conversacional · Memoria persistente · Voz (STT/TTS) · Tareas, notas, recordatorios y calendario ·
Análisis de documentos · Búsqueda web · Panel de control futurista · Multiusuario · Tiempo real.

`Next.js 14 + TypeScript + Tailwind` · `Spring Boot 3 (Java 17)` · `PostgreSQL` · `Redis` · `Docker`

</div>

---

## ✨ Características

- **Conversación inteligente** con IA (OpenAI) y *streaming* token a token (efecto JARVIS).
- **Cerebro local sin clave**: arranca y funciona sin `OPENAI_API_KEY`; al añadirla se activa el razonamiento avanzado. *Fallback* automático si la llamada remota falla.
- **Memoria persistente**: NOVA recuerda hechos, preferencias y objetivos del usuario y los usa en cada respuesta. Extracción automática desde el chat ("recuerda que…").
- **Voz**: dictado por voz (Speech-to-Text) y lectura de respuestas (Text-to-Speech) con la Web Speech API.
- **Productividad**: tareas (tablero Kanban), notas, recordatorios y calendario integrado.
- **Análisis de documentos**: sube PDF / TXT / CSV / JSON / imágenes y NOVA los resume y analiza.
- **Búsqueda web** en tiempo real (DuckDuckGo, sin clave).
- **Panel de control** tipo centro de mando con métricas en vivo y visualizaciones (arc-reactor animado).
- **Notificaciones** in-app con contador de no leídas.
- **Multiusuario** con autenticación segura **JWT** (access + refresh), roles y perfiles.
- **Tema oscuro / claro** y diseño **responsive** (PC, tablet, móvil).
- **Listo para producción**: Docker, `docker-compose`, migraciones Flyway, healthchecks, OpenAPI/Swagger.

## 🧱 Arquitectura

```
┌──────────────────────────┐      HTTPS/JSON + SSE      ┌──────────────────────────┐
│        Frontend          │  ───────────────────────▶  │         Backend          │
│  Next.js 14 (App Router) │   JWT Bearer / streaming   │   Spring Boot 3 (Java17) │
│  TypeScript + Tailwind   │  ◀───────────────────────  │   REST + SSE + Security  │
│  Zustand · Web Speech    │                            │   Flyway · OpenAPI       │
└──────────────────────────┘                            └─────────┬──────┬─────────┘
                                                                   │      │
                                                  ┌────────────────┘      └───────────────┐
                                                  ▼                                        ▼
                                         ┌─────────────────┐                      ┌─────────────────┐
                                         │   PostgreSQL    │                      │      Redis      │
                                         │  (datos + JPA)  │                      │  (caché)       │
                                         └─────────────────┘                      └─────────────────┘
                                                  ▲
                                                  │  OpenAI API (opcional)  ─────▶  modelos GPT
```

Detalle completo en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 🚀 Inicio rápido (Docker — recomendado)

Requisitos: **Docker** + **Docker Compose v2**.

```bash
# 1) Clona/copia el proyecto y entra en la carpeta
cd nova-assistant

# 2) Arranca todo (crea .env automáticamente con un JWT seguro)
bash scripts/install.sh
#   o, manualmente:
#   cp .env.example .env && docker compose up -d --build
```

Cuando termine de construir:

| Servicio       | URL                                   |
|----------------|---------------------------------------|
| **Frontend**   | http://localhost:3000                 |
| **Backend API**| http://localhost:8080                 |
| **Swagger UI** | http://localhost:8080/swagger-ui.html |
| **Health**     | http://localhost:8080/actuator/health |

**Cuenta demo (creada automáticamente):**
`demo@nova.ai` / `Demo12345`

> Para activar la IA real, añade tu `OPENAI_API_KEY` en `.env` y reinicia: `docker compose up -d`.
> Sin clave, NOVA funciona con su cerebro local.

## 🛠️ Desarrollo local (sin Docker)

Requisitos: **JDK 17**, **Maven 3.9+**, **Node 20+**, y Postgres + Redis (puedes levantarlos con `bash scripts/dev.sh`).

```bash
# Infraestructura (Postgres + Redis) en Docker
bash scripts/dev.sh

# Terminal 1 — backend
cd backend && mvn spring-boot:run

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
```

## ⚙️ Configuración (variables de entorno)

Todas viven en `.env` (ver [`.env.example`](.env.example)). Las más relevantes:

| Variable               | Por defecto                    | Descripción                                        |
|------------------------|--------------------------------|----------------------------------------------------|
| `JWT_SECRET`           | *(generado por el instalador)* | Secreto HMAC para firmar tokens (≥ 64 chars).      |
| `AI_PROVIDER`          | `openai`                       | `openai` (con fallback a mock) o `mock`.           |
| `OPENAI_API_KEY`       | *(vacío)*                      | Clave de OpenAI. Si está vacía → cerebro local.    |
| `OPENAI_MODEL`         | `gpt-4o-mini`                  | Modelo de chat.                                    |
| `OPENAI_BASE_URL`      | `https://api.openai.com/v1`    | Compatible con Azure/Ollama/LM Studio.             |
| `POSTGRES_*`           | `nova` / `nova_secret`         | Credenciales de la base de datos.                  |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:8080`        | URL del backend para el frontend.                  |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000`        | Orígenes permitidos (separados por comas).         |

## 📁 Estructura del proyecto

```
nova-assistant/
├── docker-compose.yml         # Orquestación: postgres, redis, backend, frontend
├── .env.example               # Plantilla de configuración
├── Makefile                   # Atajos (make up / down / logs …)
├── scripts/                   # install.sh, dev.sh
├── docs/                      # ARCHITECTURE, DEPLOYMENT, API
├── backend/                   # Spring Boot 3 (Java 17)
│   ├── src/main/java/com/nova/assistant/
│   │   ├── auth · user · conversation · ai · memory
│   │   ├── task · note · reminder · calendar
│   │   ├── notification · search · document · dashboard
│   │   ├── security (JWT) · config · common
│   │   └── NovaApplication.java
│   ├── src/main/resources/db/migration/   # Flyway (V1__init.sql)
│   └── Dockerfile
└── frontend/                  # Next.js 14 + TS + Tailwind
    ├── src/app/               # Rutas (auth + dashboard)
    ├── src/components/        # Sidebar, Topbar, ArcReactor, Chat…
    ├── src/lib/               # api client, speech, types, utils
    ├── src/store/             # Zustand (auth, ui)
    └── Dockerfile
```

## 🔌 API (resumen)

`POST /api/auth/register · /login · /refresh` · `GET/PATCH /api/users/me` ·
`/api/chat` (+ `/stream` SSE) · `/api/conversations` · `/api/memory` ·
`/api/tasks` · `/api/notes` · `/api/reminders` · `/api/calendar/events` ·
`/api/notifications` · `/api/search` · `/api/documents/analyze` · `/api/dashboard/summary`.

Referencia completa en [`docs/API.md`](docs/API.md) y en Swagger UI.

## 🔐 Seguridad

- Contraseñas con **BCrypt**; tokens **JWT** firmados con HMAC (access + refresh).
- Filtro de autenticación *stateless*, CORS configurable, validación de entrada (Jakarta Validation).
- Cada recurso está **aislado por usuario** (no se puede acceder a datos de otra cuenta).
- Cambia `JWT_SECRET` y las credenciales de BD antes de producción.

## 🧪 Verificación

- **Frontend**: `next build` compila las 13 rutas y `tsc --noEmit` pasa sin errores de tipos.
- **Backend**: arranca migraciones Flyway, expone `/actuator/health` y Swagger.

## 📦 Despliegue

VPS, Docker Compose y Kubernetes: ver [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## 📝 Licencia

MIT — úsalo, modifícalo y despliégalo libremente.
