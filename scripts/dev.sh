#!/usr/bin/env bash
# ===========================================================================
# NOVA Assistant - local dev helper
# Starts only infrastructure (Postgres + Redis); run backend & frontend on host.
# ===========================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
test -f .env || cp .env.example .env
echo "==> Starting infrastructure (postgres + redis)"
docker compose up -d postgres redis
echo ""
echo "Infra is up. Now run, in two terminals:"
echo "  1) cd backend  && mvn spring-boot:run"
echo "  2) cd frontend && npm install && npm run dev"
