#!/usr/bin/env python3
"""
==============================================================================
Foura Autonomous Revenue Recovery Engine - Universal One-Command Launcher
Runs on macOS, Linux, and Windows.
Usage: python3 run.py
==============================================================================
"""

import os
import sys
import subprocess
import time
import shutil
import signal

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_BACKEND_DIR = os.path.join(ROOT_DIR, "ai_backend")
VENV_DIR = os.path.join(AI_BACKEND_DIR, "venv")

# Pick platform-specific venv executable paths
if sys.platform == "win32":
    PYTHON_EXEC = os.path.join(VENV_DIR, "Scripts", "python.exe")
    UVICORN_EXEC = os.path.join(VENV_DIR, "Scripts", "uvicorn.exe")
    NPM_EXEC = shutil.which("npm.cmd") or shutil.which("npm") or "npm"
else:
    PYTHON_EXEC = os.path.join(VENV_DIR, "bin", "python3")
    UVICORN_EXEC = os.path.join(VENV_DIR, "bin", "uvicorn")
    NPM_EXEC = shutil.which("npm") or "npm"


def check_prerequisites():
    print("========================================================")
    print("  🚀 Foura Autonomous Revenue Recovery System")
    print("========================================================")

    # 1. Check Python version
    if sys.version_info < (3, 9):
        print("❌ Error: Python 3.9 or higher is required.")
        sys.exit(1)

    # 2. Check Node.js and npm
    if not shutil.which("npm") and not shutil.which("npm.cmd"):
        print("❌ Error: Node.js / npm is not installed or not in PATH.")
        print("👉 Please install Node.js from https://nodejs.org/")
        sys.exit(1)

    # 3. Ensure .env exists in ai_backend
    env_file = os.path.join(AI_BACKEND_DIR, ".env")
    env_example = os.path.join(AI_BACKEND_DIR, ".env.example")
    if not os.path.exists(env_file) and os.path.exists(env_example):
        print("⚙️  Creating default ai_backend/.env from .env.example...")
        shutil.copyfile(env_example, env_file)


def kill_ports():
    """Kill any stale processes on 8003 and 5173 on Unix/Mac."""
    if sys.platform != "win32":
        try:
            subprocess.run("lsof -ti:8003 -ti:5173 | xargs kill -9 2>/dev/null || true", shell=True)
        except Exception:
            pass


def setup_virtualenv():
    """Ensure python virtual environment and requirements are installed."""
    if not os.path.exists(VENV_DIR) or not os.path.exists(PYTHON_EXEC):
        print("📦 Creating virtual environment in ai_backend/venv...")
        subprocess.run([sys.executable, "-m", "venv", VENV_DIR], check=True)

    # Install / verify requirements
    req_file = os.path.join(AI_BACKEND_DIR, "requirements.txt")
    if os.path.exists(req_file):
        print("📦 Verifying backend dependencies...")
        subprocess.run([PYTHON_EXEC, "-m", "pip", "install", "-q", "-r", req_file], check=True)


def setup_frontend():
    """Ensure node_modules are installed."""
    node_modules = os.path.join(ROOT_DIR, "node_modules")
    if not os.path.exists(node_modules):
        print("📦 Installing frontend packages via npm...")
        subprocess.run([NPM_EXEC, "install"], cwd=ROOT_DIR, check=True)


def main():
    check_prerequisites()
    kill_ports()
    setup_virtualenv()
    setup_frontend()

    processes = []

    def shutdown(sig=None, frame=None):
        print("\n🛑 Stopping Foura services...")
        for p in processes:
            try:
                p.terminate()
                p.wait(timeout=2)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass
        kill_ports()
        print("✅ All services stopped safely.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print("\n⚡ Starting FastAPI Backend on http://localhost:8003...")
    backend_cmd = [PYTHON_EXEC, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
    p_backend = subprocess.Popen(backend_cmd, cwd=AI_BACKEND_DIR)
    processes.append(p_backend)

    # Give backend a moment to bind
    time.sleep(1.2)

    print("🌐 Starting Vite Frontend on http://localhost:5173...")
    frontend_cmd = [NPM_EXEC, "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
    p_frontend = subprocess.Popen(frontend_cmd, cwd=ROOT_DIR)
    processes.append(p_frontend)

    print("\n========================================================")
    print("  ✅ Foura is Live & Running!")
    print("  👉 Dashboard: http://localhost:5173")
    print("  👉 API Docs:  http://localhost:8003/docs")
    print("  👉 WebSocket: ws://localhost:8003/ws")
    print("========================================================")
    print("Press Ctrl+C to stop all services.\n")

    try:
        while True:
            time.sleep(1)
            # Check if any process crashed unexpectedly
            if p_backend.poll() is not None:
                print("⚠️ Backend exited with code:", p_backend.poll())
                break
            if p_frontend.poll() is not None:
                print("⚠️ Frontend exited with code:", p_frontend.poll())
                break
    except KeyboardInterrupt:
        pass
    finally:
        shutdown()


if __name__ == "__main__":
    main()
