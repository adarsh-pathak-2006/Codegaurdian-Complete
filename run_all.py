#!/usr/bin/env python3
"""
CodeGuardian - Unified Local Development Runner & Build Orchestrator
===================================================================
Runs the Django backend, Celery workers, and Next.js frontend
concurrently from a single terminal with colored output and clean shutdown.

Usage:
    python run_all.py                # Runs Backend + Frontend (in-process scanning)
    python run_all.py --worker       # Runs Backend + Frontend + Celery Worker
    python run_all.py --setup        # Installs deps, runs migrations & seeds demo
    python run_all.py --build        # Builds frontend production bundle
"""

import os
import sys
import time
import signal
import shutil
import argparse
import threading
import subprocess
from pathlib import Path

# Setup Root Paths
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"

# Virtual environment python resolution
IS_WINDOWS = sys.platform.startswith("win")
if IS_WINDOWS:
    VENV_PY = ROOT_DIR / ".venv" / "Scripts" / "python.exe"
    VENV_CELERY = ROOT_DIR / ".venv" / "Scripts" / "celery.exe"
    NPM_CMD = shutil.which("npm.cmd") or shutil.which("npm") or "npm"
else:
    VENV_PY = ROOT_DIR / ".venv" / "bin" / "python"
    VENV_CELERY = ROOT_DIR / ".venv" / "bin" / "celery"
    NPM_CMD = shutil.which("npm") or "npm"

PYTHON_BIN = str(VENV_PY if VENV_PY.exists() else Path(sys.executable))
CELERY_BIN = str(VENV_CELERY if VENV_CELERY.exists() else "celery")

# Terminal ANSI Color Codes
RESET = "\033[0m"
BOLD = "\033[1m"
GREEN = "\033[32m"
BLUE = "\033[34m"
CYAN = "\033[36m"
MAGENTA = "\033[35m"
YELLOW = "\033[33m"
RED = "\033[31m"


def log_banner(msg: str):
    print(f"\n{BOLD}{CYAN}=== {msg} ==={RESET}\n")


def log_info(prefix: str, msg: str, color: str = GREEN):
    print(f"{color}{BOLD}[{prefix}]{RESET} {msg}")


class ServiceRunner:
    def __init__(self):
        self.processes = []
        self.running = True

    def stream_output(self, proc: subprocess.Popen, prefix: str, color: str):
        """Reads lines from subprocess stdout/stderr and prints with color tag."""
        try:
            for line in iter(proc.stdout.readline, ""):
                if not line:
                    break
                text = line.rstrip("\r\n")
                if text:
                    print(f"{color}{BOLD}[{prefix:<8}]{RESET} {text}")
        except Exception:
            pass

    def start_process(self, name: str, cmd: list, cwd: Path, color: str, env: dict = None):
        """Starts a background process and connects output streamer."""
        full_env = os.environ.copy()
        if env:
            full_env.update(env)

        log_info("START", f"Starting {name}: {' '.join(cmd)}", color)
        
        proc = subprocess.Popen(
            cmd,
            cwd=str(cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=full_env,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if IS_WINDOWS else 0,
        )
        self.processes.append((name, proc))

        # Launch reader thread
        thread = threading.Thread(
            target=self.stream_output,
            args=(proc, name, color),
            daemon=True
        )
        thread.start()

    def run_setup(self):
        """Runs migrations and database demo seeding."""
        log_banner("Running Backend Database Migrations")
        res = subprocess.run([PYTHON_BIN, "manage.py", "migrate"], cwd=str(BACKEND_DIR))
        if res.returncode != 0:
            log_info("ERROR", "Migrations failed!", RED)
            sys.exit(1)

        log_banner("Seeding Demo Security Data & Users")
        subprocess.run([PYTHON_BIN, "manage.py", "seed_demo"], cwd=str(BACKEND_DIR))

    def run_build(self):
        """Builds Next.js frontend production bundle."""
        log_banner("Building Frontend Production Bundle")
        res = subprocess.run([NPM_CMD, "run", "build"], cwd=str(FRONTEND_DIR))
        if res.returncode != 0:
            log_info("ERROR", "Frontend build failed!", RED)
            sys.exit(1)
        log_info("BUILD", "Frontend built successfully!", GREEN)

    def stop_all(self):
        """Cleanly terminates all child processes."""
        if not self.running:
            return
        self.running = False
        print(f"\n{YELLOW}Shutting down all CodeGuardian services...{RESET}")
        
        for name, proc in self.processes:
            try:
                log_info("STOP", f"Terminating {name} (PID: {proc.pid})...", YELLOW)
                if IS_WINDOWS:
                    subprocess.call(["taskkill", "/F", "/T", "/PID", str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    proc.terminate()
            except Exception:
                pass
        
        log_info("STOP", "All services shut down cleanly. Bye!", GREEN)


def main():
    parser = argparse.ArgumentParser(
        description="CodeGuardian Unified Local Development Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--worker", action="store_true", help="Launch Celery background worker (requires Redis)")
    parser.add_argument("--setup", action="store_true", help="Run migrations and seed demo data before starting")
    parser.add_argument("--build", action="store_true", help="Build Next.js frontend bundle and exit")
    parser.add_argument("--backend-only", action="store_true", help="Start only backend services")
    parser.add_argument("--frontend-only", action="store_true", help="Start only Next.js frontend")
    args = parser.parse_args()

    runner = ServiceRunner()

    # Register exit handlers for Ctrl+C
    def sig_handler(sig, frame):
        runner.stop_all()
        sys.exit(0)

    signal.signal(signal.SIGINT, sig_handler)
    signal.signal(signal.SIGTERM, sig_handler)

    print(f"""
{CYAN}{BOLD}
   ____          _        ____                     _ _             
  / ___|___   __| | ___  / ___|_   _  __ _ _ __ __| (_) __ _ _ __  
 | |   / _ \\ / _` |/ _ \\| |  _| | | |/ _` | '__/ _` | |/ _` | '_ \\ 
 | |__| (_) | (_| |  __/| |_| | |_| | (_| | | | (_| | | (_| | | | |
  \\____\\___/ \\__,_|\\___| \\____|\\__,_|\\__,_|_|  \\__,_|_|\\__,_|_| |_|
{RESET}
  🛡️  AI Security Platform for Modern Codebases
  🚀  Backend API:  {BOLD}http://127.0.0.1:8000{RESET}
  🌐  Frontend UI:  {BOLD}http://localhost:3000{RESET}
  📚  API Docs:     {BOLD}http://127.0.0.1:8000/api/docs/{RESET}
    """)

    # Build only mode
    if args.build:
        runner.run_build()
        return

    # Setup mode
    if args.setup:
        runner.run_setup()

    # 1. Start Django Backend API
    if not args.frontend_only:
        backend_cmd = [PYTHON_BIN, "manage.py", "runserver", "127.0.0.1:8000"]
        runner.start_process("BACKEND", backend_cmd, BACKEND_DIR, BLUE)

    # 2. Optionally start Celery Worker
    if args.worker and not args.frontend_only:
        # On Windows, Celery needs '-P solo' or 'eventlet'
        worker_cmd = [CELERY_BIN, "-A", "codeguardian", "worker", "-l", "info", "-P", "solo"]
        worker_env = {"CELERY_ALWAYS_EAGER": "False"}
        runner.start_process("WORKER", worker_cmd, BACKEND_DIR, MAGENTA, env=worker_env)

    # 3. Start Next.js Frontend
    if not args.backend_only:
        # Give backend a moment to bind
        time.sleep(1)
        frontend_cmd = [NPM_CMD, "run", "dev"]
        runner.start_process("FRONTEND", frontend_cmd, FRONTEND_DIR, CYAN)

    log_banner("All Services Running! Press Ctrl+C to stop all.")

    # Keep main thread alive
    try:
        while runner.running:
            time.sleep(1)
    except KeyboardInterrupt:
        runner.stop_all()


if __name__ == "__main__":
    main()
