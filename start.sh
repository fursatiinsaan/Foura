#!/bin/bash

# ==============================================================================
# Foura Autonomous Revenue Recovery - All-in-One Launcher
# Starts both the AI FastAPI Backend and React Frontend in a single command.
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "========================================================"
echo "  🚀 Starting Foura AI Revenue Recovery System"
echo "========================================================"

# 1. Clean up any existing stale processes on ports 8003 & 5173
echo "🧹 Checking & freeing ports 8003 and 5173..."
lsof -ti:8003 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# 2. Check and initialize Python 3.11 Virtual Environment if missing
if [ ! -d "$PROJECT_DIR/ai_backend/venv" ]; then
    echo "📦 Creating Python virtual environment in ai_backend/venv..."
    if command -v /opt/homebrew/bin/python3.11 &> /dev/null; then
        /opt/homebrew/bin/python3.11 -m venv "$PROJECT_DIR/ai_backend/venv"
    else
        python3 -m venv "$PROJECT_DIR/ai_backend/venv"
    fi
    source "$PROJECT_DIR/ai_backend/venv/bin/activate"
    pip install --upgrade pip
    pip install -r "$PROJECT_DIR/ai_backend/requirements.txt"
    pip install "setuptools<70.0.0"
fi

# 3. Check and install Node dependencies if missing
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo "📦 Installing Node dependencies..."
    npm install
fi

# Graceful shutdown handler
cleanup() {
    echo ""
    echo "🛑 Shutting down Foura services..."
    kill $(jobs -p) 2>/dev/null || true
    lsof -ti:8003 | xargs kill -9 2>/dev/null || true
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    echo "✅ All services stopped safely."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 4. Start FastAPI Backend
echo "⚡ Starting AI Backend on http://localhost:8003..."
source "$PROJECT_DIR/ai_backend/venv/bin/activate"
cd "$PROJECT_DIR/ai_backend"
uvicorn app.main:app --host 0.0.0.0 --port 8003 &
BACKEND_PID=$!
cd "$PROJECT_DIR"

# Wait for backend to initialize
sleep 2

# 5. Start React / Vite Frontend
echo "💻 Starting Frontend Dashboard on http://localhost:5173..."
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

echo ""
echo "========================================================"
echo "  ✅ Foura Fullstack System is LIVE!"
echo "  👉 Dashboard: http://localhost:5173"
echo "  👉 AI API:    http://localhost:8003/api/metrics"
echo "========================================================"
echo "  Press Ctrl + C to stop all services anytime."
echo "========================================================"

wait
