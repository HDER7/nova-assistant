#!/usr/bin/env bash
# ===========================================================================
# NOVA Assistant - one-shot installer / bootstrapper
# Brings up the whole stack with Docker. Requires: docker + docker compose v2.
# ===========================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

cyan() { printf "\033[36m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
red() { printf "\033[31m%s\033[0m\n" "$1"; }

cyan "==> Checking prerequisites"
command -v docker >/dev/null 2>&1 || { red "Docker is not installed."; exit 1; }
docker compose version >/dev/null 2>&1 || { red "Docker Compose v2 required."; exit 1; }

if [ ! -f .env ]; then
  cyan "==> Creating .env from template"
  cp .env.example .env
  if command -v openssl >/dev/null 2>&1; then
    SECRET="$(openssl rand -hex 48)"
    sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" .env && rm -f .env.bak
    green "    Generated a random JWT_SECRET."
  fi
  green "    .env created. Add your OPENAI_API_KEY for live AI (optional)."
else
  green "==> .env already exists, keeping it."
fi

cyan "==> Building and starting containers"
docker compose up -d --build

cyan "==> Service status:"
sleep 5
docker compose ps

green ""
green "NOVA is starting up."
green "  Frontend : http://localhost:${FRONTEND_PORT:-3000}"
green "  Backend  : http://localhost:${BACKEND_PORT:-8080}"
green "  API docs : http://localhost:${BACKEND_PORT:-8080}/swagger-ui.html"
