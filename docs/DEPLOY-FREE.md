# NOVA · Despliegue gratuito (Vercel + Render + Neon + Upstash + Groq)

Stack 100% gratis. Tiempo estimado: ~30-40 min. Lo único a tener en cuenta del plan gratis
de Render: el backend **se duerme** tras 15 min sin uso y el primer acceso tarda ~40 s en
despertar (luego va fluido).

```
Navegador → Vercel (Next.js)  →  Render (Spring Boot)  →  Neon (PostgreSQL)
                                          ├──────────────→  Upstash (Redis)
                                          └──────────────→  Groq (IA) · VirusTotal
```

Cuentas gratis necesarias: **GitHub**, **Neon**, **Upstash**, **Render**, **Vercel**.
Claves que ya tienes: **Groq** (`gsk_…`) y **VirusTotal**.

---

## Paso 0 · Limpiar y subir el proyecto a GitHub

En la carpeta `nova-assistant` (PowerShell):

```bash
# (opcional) borra los temporales de las pruebas locales
del *.bat probe*.sh _verify.txt _nova_status.txt _openai_test.txt _models.txt 2>nul

git init
git add .
git commit -m "NOVA assistant"
# crea un repo vacío en https://github.com/new (p.ej. "nova-assistant", privado)
git branch -M main
git remote add origin https://github.com/TU_USUARIO/nova-assistant.git
git push -u origin main
```

> El `.gitignore` ya excluye `.env`, `node_modules`, `target`, los `*.bat` y los temporales,
> así que **tus claves no se suben**.

---

## Paso 1 · Base de datos → Neon (PostgreSQL gratis)

1. Entra en **https://neon.tech** → *Sign up* (con GitHub) → *Create project* (región más cercana).
2. En **Dashboard → Connect**, copia los datos de conexión. Necesitas tres valores para Render:
   - **Host**: algo como `ep-cool-name-123456.us-east-2.aws.neon.tech`
   - **Database**: normalmente `neondb`
   - **User** y **Password**
3. Construye la **URL JDBC** así (añade `?sslmode=require`):
   ```
   jdbc:postgresql://<HOST>/<DATABASE>?sslmode=require
   ```
   Ejemplo: `jdbc:postgresql://ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require`

> Flyway creará todas las tablas y el usuario demo automáticamente en el primer arranque.

---

## Paso 2 · Caché → Upstash (Redis gratis)

1. Entra en **https://upstash.com** → *Sign up* → *Create Database* (tipo Redis, región cercana, TLS activado).
2. En la página de la base, copia:
   - **Endpoint (host)**: `xxx-yyyy.upstash.io`
   - **Port**: `6379`
   - **Password**

> NOVA funciona aunque Redis falle (no es crítico), pero así lo dejas listo.

---

## Paso 3 · Backend → Render (Spring Boot, Docker, gratis)

1. Entra en **https://render.com** → *Sign up* con GitHub.
2. **New → Blueprint** → elige tu repo `nova-assistant`. Render detectará el `render.yaml` y
   creará el servicio **nova-backend** (Docker, plan free). Pulsa *Apply*.
3. Te pedirá los valores marcados como secretos. Rellena en **Environment**:

   | Variable | Valor |
   |---|---|
   | `NOVA_AI_OPENAI_API_KEY` | tu clave de Groq (`gsk_…`) |
   | `NOVA_SOC_VIRUSTOTAL_API_KEY` | tu clave de VirusTotal |
   | `NOVA_JWT_SECRET` | un secreto largo (genera uno: `openssl rand -hex 48`) |
   | `SPRING_DATASOURCE_URL` | la URL JDBC de Neon (Paso 1) |
   | `SPRING_DATASOURCE_USERNAME` | el user de Neon |
   | `SPRING_DATASOURCE_PASSWORD` | el password de Neon |
   | `SPRING_DATA_REDIS_HOST` | el host de Upstash |
   | `SPRING_DATA_REDIS_PASSWORD` | el password de Upstash |
   | `NOVA_CORS_ALLOWED_ORIGINS` | *(déjalo vacío de momento; lo pones en el Paso 5)* |

   (`SPRING_DATA_REDIS_PORT=6379`, `SPRING_DATA_REDIS_SSL=true`, el modelo y la URL de Groq ya
   vienen puestos por el `render.yaml`.)
4. *Create / Deploy*. El primer build tarda unos minutos (compila el `.jar` con Maven).
5. Cuando esté **Live**, anota la URL del backend, p. ej. `https://nova-backend.onrender.com`.
   Pruébala: `https://nova-backend.onrender.com/actuator/health` → debe decir `{"status":"UP"}`.

---

## Paso 4 · Frontend → Vercel (Next.js, gratis)

1. Entra en **https://vercel.com** → *Sign up* con GitHub → *Add New → Project* → importa `nova-assistant`.
2. **Root Directory**: pon `frontend` (importante, el proyecto es un monorepo).
3. **Environment Variables**: añade
   - `NEXT_PUBLIC_API_URL` = la URL de tu backend en Render (Paso 3.5), p. ej. `https://nova-backend.onrender.com`
4. *Deploy*. Al terminar tendrás una URL tipo `https://nova-assistant.vercel.app`.

> `NEXT_PUBLIC_API_URL` se "hornea" en el build, así que si luego cambia la URL del backend,
> vuelve a desplegar el frontend.

---

## Paso 5 · Conectar CORS (último paso)

1. Vuelve a **Render → nova-backend → Environment** y pon:
   - `NOVA_CORS_ALLOWED_ORIGINS` = tu URL de Vercel (sin barra final), p. ej. `https://nova-assistant.vercel.app`
2. Guarda → Render redepliega solo (~1 min).

---

## Paso 6 · Probar

1. Abre tu URL de Vercel. (La **primera** petición puede tardar ~40 s si el backend estaba dormido.)
2. Inicia sesión con la cuenta demo: **`demo@nova.ai` / `Demo12345`**  (o regístrate).
3. Prueba el **Chat** ("recuérdame el cambio de turno mañana 6am"), el **SOC** (IOCs, VT, CVE) y verás
   el pill **IA en línea · llama-3.3-70b-versatile**.

---

## Notas y mejoras

- **Cold start (Render free)**: para evitar el arranque en frío puedes pasar el backend a un plan
  de pago (~7 $/mes) o usar un *cron* que haga ping a `/actuator/health` cada 10 min
  (p. ej. con cron-job.org gratis).
- **Siempre encendido y más barato**: un VPS de ~4-5 $/mes ejecutando el mismo `docker compose up -d`
  te da todo junto sin dormir (ver `docs/DEPLOYMENT.md`).
- **Seguridad**: rota las claves que compartiste por chat y nunca subas el `.env` (ya está en `.gitignore`).
- **Privacidad SOC**: recuerda que con Groq los prompts salen a un tercero; para datos sensibles, en
  local puedes usar Ollama (ver respuesta anterior).
