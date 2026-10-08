.PHONY: dev dev-worker setup build migrate seed test clean help

help:
	@echo "CodeGuardian Build & Run Commands:"
	@echo "  make dev         - Run backend and frontend concurrently"
	@echo "  make dev-worker  - Run backend, Celery worker, and frontend"
	@echo "  make setup       - Run database migrations and seed demo data"
	@echo "  make build       - Build frontend production bundle"
	@echo "  make test        - Run backend test suite"
	@echo "  make clean       - Remove temporary artifacts and caches"

dev:
	python run_all.py

dev-worker:
	python run_all.py --worker

setup:
	python run_all.py --setup

build:
	python run_all.py --build

test:
	pytest backend/tests/

clean:
	rm -rf backend/.pytest_cache frontend/.next frontend/node_modules/.cache
