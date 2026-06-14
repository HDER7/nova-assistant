# NOVA · Referencia de la API

Base URL: `http://localhost:8080`  ·  Todas las rutas (salvo `/api/auth/*`) requieren
cabecera `Authorization: Bearer <accessToken>`.  ·  Swagger UI: `/swagger-ui.html`.

## Autenticación

### `POST /api/auth/register`
```json
{ "email": "ana@correo.com", "password": "Secreta123", "displayName": "Ana" }
```
Respuesta `201`:
```json
{
  "accessToken": "eyJ...", "refreshToken": "eyJ...",
  "tokenType": "Bearer", "expiresIn": 1800,
  "user": { "id": "…", "email": "ana@correo.com", "displayName": "Ana", "role": "USER", "theme": "dark", "locale": "es", "persona": "NOVA" }
}
```

### `POST /api/auth/login`
```json
{ "email": "demo@nova.ai", "password": "Demo12345" }
```

### `POST /api/auth/refresh`
```json
{ "refreshToken": "eyJ..." }
```

## Usuario
- `GET /api/users/me` → perfil actual.
- `PATCH /api/users/me` → `{ "displayName": "…", "avatarUrl": "…" }`.
- `PATCH /api/users/me/preferences` → `{ "theme": "dark|light", "locale": "es|en", "persona": "NOVA" }`.

## Chat e IA
- `POST /api/chat` → `{ "conversationId": "…|null", "message": "Hola" }` → `{ conversationId, message }`.
- `POST /api/chat/stream` → igual cuerpo; responde **text/event-stream** con eventos:
  - `event: meta`  → `{ "conversationId": "…" }`
  - `event: token` → `{ "t": "fragmento " }`
  - `event: done`  → mensaje final `{ id, role, content, tokens, createdAt }`
- `GET /api/chat/status` → `{ "provider": "openai:gpt-4o-mini|mock", "live": true|false, "model": "…" }`.

## Conversaciones
- `GET /api/conversations` · `POST /api/conversations` `{ "title?": "…" }`
- `GET /api/conversations/{id}` · `GET /api/conversations/{id}/messages`
- `PATCH /api/conversations/{id}` `{ "title?": "…", "pinned?": true }` · `DELETE /api/conversations/{id}`

## Memoria
- `GET /api/memory`
- `POST /api/memory` `{ "content": "Prefiere el té", "kind": "PREFERENCE", "importance": 4 }`
- `DELETE /api/memory/{id}`

## Tareas
- `GET /api/tasks[?status=TODO|IN_PROGRESS|DONE]` · `GET /api/tasks/stats`
- `POST /api/tasks` `{ "title": "…", "description?": "…", "priority?": "LOW|MEDIUM|HIGH|URGENT", "dueAt?": "ISO-8601" }`
- `PATCH /api/tasks/{id}` `{ "status?": "DONE", "priority?": "…", … }` · `DELETE /api/tasks/{id}`

## Notas
- `GET /api/notes` · `POST /api/notes` `{ "title?": "…", "content": "…", "tags?": ["a","b"] }`
- `PATCH /api/notes/{id}` `{ "title?", "content?", "tags?", "pinned?" }` · `DELETE /api/notes/{id}`

## Recordatorios
- `GET /api/reminders` · `POST /api/reminders` `{ "title": "…", "remindAt": "ISO-8601", "recurrence?": "NONE|DAILY|WEEKLY|MONTHLY" }`
- `PATCH /api/reminders/{id}` `{ "completed?": true, … }` · `DELETE /api/reminders/{id}`

## Calendario
- `GET /api/calendar/events[?from=ISO&to=ISO]`
- `POST /api/calendar/events` `{ "title": "…", "startAt": "ISO", "endAt": "ISO", "location?": "…", "color?": "cyan", "allDay?": false }`
- `PATCH /api/calendar/events/{id}` · `DELETE /api/calendar/events/{id}`

## Notificaciones
- `GET /api/notifications` · `GET /api/notifications/unread-count`
- `POST /api/notifications/{id}/read` · `POST /api/notifications/read-all`
- `POST /api/notifications` `{ "type?": "INFO|SUCCESS|WARNING|ALERT|REMINDER|SYSTEM", "title": "…", "body?": "…" }`
- `DELETE /api/notifications/{id}`

## Búsqueda web
- `GET /api/search?q=consulta` → `{ "query", "results": [{ "title", "snippet", "url" }], "count" }`

## Documentos
- `POST /api/documents/analyze` (multipart): campo `file` (PDF/TXT/CSV/JSON/imagen) + `prompt?`.
  → `{ "filename", "contentType", "characters", "analysis" }`

## Panel
- `GET /api/dashboard/summary` → `{ tasks:{total,todo,inProgress,done}, notes, remindersPending, upcomingEvents, conversations, memories, unreadNotifications }`

## Errores
Formato uniforme:
```json
{ "timestamp": "…", "status": 404, "error": "Not Found", "message": "Tarea no encontrada", "path": "/api/tasks/…" }
```
Validación (`400`) incluye `fieldErrors: { campo: "mensaje" }`.
