#!/bin/bash

# ─── Verifair — Stop All Services ───

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Stopping Verifair..."

# Kill Backend (uvicorn)
echo "  Stopping backend (uvicorn)..."
pkill -f "uvicorn backend.main:app" || echo "  Backend not running."

# Kill Frontend (Next.js on port 3000)
PID_FRONTEND=$(lsof -ti:3000)
if [ ! -z "$PID_FRONTEND" ]; then
    echo "  Stopping frontend (PID: $PID_FRONTEND)..."
    kill -9 $PID_FRONTEND
else
    echo "  Frontend not running on port 3000."
fi

# Kill Ngrok
echo "  Stopping ngrok..."
pkill -f "ngrok http 8000" || echo "  Ngrok not running."

echo "All Verifair processes stopped."
