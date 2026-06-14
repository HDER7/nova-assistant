# NOVA · Guía de despliegue

NOVA se distribuye contenedorizado, por lo que puede desplegarse en cualquier sitio que
ejecute contenedores: un **VPS**, **Docker Compose**, o **Kubernetes**.

---

## 1) Producción con Docker Compose (VPS)

Ideal para un único servidor (DigitalOcean, Hetzner, AWS EC2, etc.).

### Requisitos
- Linux con **Docker** + **Docker Compose v2**.
- Un dominio apuntando al servidor (para TLS) — opcional pero recomendado.

### Pasos
```bash
# 1. Copia el proyecto al servidor y entra
cd nova-assistant

# 2. Crea y edita el entorno
cp .env.example .env
nano .env            # ⚠️ cambia JWT_SECRET, POSTGRES_PASSWORD, REDIS_PASSWORD,
                     #     OPENAI_API_KEY, y NEXT_PUBLIC_API_URL / CORS a tu dominio

# 3. Genera un secreto fuerte
openssl rand -hex 48      # pégalo en JWT_SECRET

# 4. Arranca
docker compose up -d --build
docker compose ps
```

### Valores de `.env` para producción
```env
JWT_SECRET=<openssl rand -hex 48>
POSTGRES_PASSWORD=<contraseña robusta>
REDIS_PASSWORD=<contraseña robusta>
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_API_URL=https://api.tudominio.com
CORS_ALLOWED_ORIGINS=https://app.tudominio.com
```

### TLS / Reverse proxy (Nginx)
Coloca un proxy delante para terminar HTTPS. Ejemplo de bloque Nginx:

```nginx
# Frontend (app.tudominio.com)
server {
  listen 443 ssl;
  server_name app.tudominio.com;
  ssl_certificate     /etc/letsencrypt/live/app.tudominio.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.tudominio.com/privkey.pem;
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
}

# Backend (api.tudominio.com) — importante para SSE
server {
  listen 443 ssl;
  server_name api.tudominio.com;
  ssl_certificate     /etc/letsencrypt/live/api.tudominio.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.tudominio.com/privkey.pem;
  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;          # ← necesario para el streaming SSE del chat
    chunked_transfer_encoding off;
  }
}
```
Usa [certbot](https://certbot.eff.org/) para emitir los certificados Let's Encrypt.

### Operación
```bash
docker compose logs -f            # ver logs
docker compose pull && docker compose up -d --build   # actualizar
docker compose down               # parar
```

### Copias de seguridad (PostgreSQL)
```bash
# Backup
docker exec nova-postgres pg_dump -U nova nova > backup_$(date +%F).sql
# Restore
cat backup.sql | docker exec -i nova-postgres psql -U nova -d nova
```

---

## 2) Kubernetes

Manifiestos de referencia. Crea primero el `Secret` y `ConfigMap`, construye y publica las
imágenes (`backend` y `frontend`) en tu registro, y aplica los `Deployment`/`Service`.

### Secret + Config
```yaml
apiVersion: v1
kind: Secret
metadata: { name: nova-secrets }
type: Opaque
stringData:
  POSTGRES_PASSWORD: "cambia-esto"
  REDIS_PASSWORD: "cambia-esto"
  JWT_SECRET: "cadena-aleatoria-de-64-chars"
  OPENAI_API_KEY: "sk-..."
---
apiVersion: v1
kind: ConfigMap
metadata: { name: nova-config }
data:
  POSTGRES_DB: "nova"
  POSTGRES_USER: "nova"
  SPRING_DATA_REDIS_HOST: "nova-redis"
  NOVA_CORS_ALLOWED_ORIGINS: "https://app.tudominio.com"
```

### Backend (Deployment + Service)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: nova-backend }
spec:
  replicas: 2
  selector: { matchLabels: { app: nova-backend } }
  template:
    metadata: { labels: { app: nova-backend } }
    spec:
      containers:
        - name: backend
          image: registry.tudominio.com/nova-backend:1.0.0
          ports: [{ containerPort: 8080 }]
          envFrom:
            - configMapRef: { name: nova-config }
            - secretRef: { name: nova-secrets }
          env:
            - { name: SPRING_DATASOURCE_URL, value: "jdbc:postgresql://nova-postgres:5432/nova" }
            - { name: SPRING_DATASOURCE_USERNAME, value: "nova" }
            - { name: SPRING_DATASOURCE_PASSWORD, valueFrom: { secretKeyRef: { name: nova-secrets, key: POSTGRES_PASSWORD } } }
          readinessProbe:
            httpGet: { path: /actuator/health, port: 8080 }
            initialDelaySeconds: 30
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata: { name: nova-backend }
spec:
  selector: { app: nova-backend }
  ports: [{ port: 8080, targetPort: 8080 }]
```

### Frontend (Deployment + Service)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: nova-frontend }
spec:
  replicas: 2
  selector: { matchLabels: { app: nova-frontend } }
  template:
    metadata: { labels: { app: nova-frontend } }
    spec:
      containers:
        - name: frontend
          image: registry.tudominio.com/nova-frontend:1.0.0
          ports: [{ containerPort: 3000 }]
          env:
            - { name: NEXT_PUBLIC_API_URL, value: "https://api.tudominio.com" }
---
apiVersion: v1
kind: Service
metadata: { name: nova-frontend }
spec:
  selector: { app: nova-frontend }
  ports: [{ port: 3000, targetPort: 3000 }]
```

> **PostgreSQL y Redis**: en Kubernetes usa charts de Helm (Bitnami) o servicios
> gestionados (RDS, ElastiCache, Cloud SQL, Memorystore) y apunta las variables de
> conexión a ellos. Para `Ingress`, expón `nova-frontend` y `nova-backend` con tu
> controlador (nginx-ingress/Traefik) y `proxy-buffering: off` en la ruta del backend
> para el streaming SSE.

### Imágenes
```bash
# Backend
docker build -t registry.tudominio.com/nova-backend:1.0.0 ./backend
docker push registry.tudominio.com/nova-backend:1.0.0
# Frontend (incrusta la URL pública del API en build-time)
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.tudominio.com \
  -t registry.tudominio.com/nova-frontend:1.0.0 ./frontend
docker push registry.tudominio.com/nova-frontend:1.0.0
```

---

## 3) Plataformas cloud gestionadas

- **Frontend** → Vercel / Netlify / Cloud Run. Configura `NEXT_PUBLIC_API_URL`.
- **Backend** → Render / Railway / Fly.io / Cloud Run / ECS. Usa la imagen de `backend/`.
- **DB/Caché** → Postgres y Redis gestionados; inyecta las variables `SPRING_DATASOURCE_*`
  y `SPRING_DATA_REDIS_*`.

## Lista de verificación pre-producción

- [ ] `JWT_SECRET` largo y aleatorio (≥ 64 chars).
- [ ] Contraseñas de Postgres y Redis robustas y únicas.
- [ ] `CORS_ALLOWED_ORIGINS` restringido a tu dominio real.
- [ ] HTTPS terminado en el proxy/ingress; `proxy_buffering off` para SSE.
- [ ] `OPENAI_API_KEY` configurada (o `AI_PROVIDER=mock` a propósito).
- [ ] Backups programados de PostgreSQL.
- [ ] Límites de recursos y *réplicas* según carga.
