.PHONY: help install setup test lint run-daily run-backfill start-api start-scheduler docker-up docker-down

help:
	@echo "Available commands:"
	@echo "  install          - Install dependencies from requirements.txt"
	@echo "  setup            - Initialize database schema and trading calendar"
	@echo "  test             - Run pytest test suite"
	@echo "  lint             - Run ruff linter"
	@echo "  run-daily        - Run daily 4:00 PM EOD update"
	@echo "  run-backfill     - Run backfill (pass START and END)"
	@echo "  start-api        - Start FastAPI server"
	@echo "  start-scheduler  - Run blocking APScheduler daemon"
	@echo "  docker-up        - Start services via docker-compose"
	@echo "  docker-down      - Stop docker-compose services"

install:
	pip install -r requirements.txt
	pip install -e .

setup:
	python -m nse_pipeline.cli.setup_database

test:
	pytest tests/ -v

lint:
	ruff check .

run-daily:
	python -m nse_pipeline.cli.daily_update

run-backfill:
	python -m nse_pipeline.cli.backfill --start $(START) --end $(END)

start-api:
	uvicorn nse_pipeline.api.app:app --reload --port 8000

start-scheduler:
	python -m nse_pipeline.scheduler.daily_scheduler

docker-up:
	docker compose up -d

docker-down:
	docker compose down
