# NOVA Assistant - convenience targets
.PHONY: help setup up down logs restart build clean backend frontend

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: ## Copy .env.example -> .env if missing
	@test -f .env || cp .env.example .env && echo "Created .env (edit it before going to production)."

up: setup ## Start the full stack (detached)
	docker compose up -d --build

down: ## Stop the stack
	docker compose down

logs: ## Tail logs from all services
	docker compose logs -f

restart: ## Restart the stack
	docker compose down && docker compose up -d --build

build: ## Build images without starting
	docker compose build

clean: ## Stop and remove volumes (DESTROYS DATA)
	docker compose down -v

backend: ## Run backend locally (needs JDK 17 + Maven)
	cd backend && mvn spring-boot:run

frontend: ## Run frontend locally (needs Node 20+)
	cd frontend && npm install && npm run dev
