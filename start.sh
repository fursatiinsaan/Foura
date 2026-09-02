#!/bin/bash
# ==============================================================================
# Foura Autonomous Revenue Recovery - One-Command Launcher (Bash)
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Delegate to cross-platform Python orchestrator
if command -v python3 &> /dev/null; then
    exec python3 run.py
elif command -v python &> /dev/null; then
    exec python run.py
else
    echo "❌ Error: Python 3 is required to run Foura."
    exit 1
fi
