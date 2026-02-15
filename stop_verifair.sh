#!/bin/bash

echo "🛑 Stopping Verifair..."

# Kill Backend (uvicorn)
echo "Killing Backend (uvicorn)..."
pkill -f "uvicorn backend.main:app" || echo "Backend not running."

# Kill Frontend (Next.js server on port 3000)
# We find the PID listening on port 3000 and kill it
PID_FRONTEND=$(lsof -ti:3000)
if [ ! -z "$PID_FRONTEND" ]; then
    echo "Killing Frontend (PID: $PID_FRONTEND on port 3000)..."
    kill -9 $PID_FRONTEND
else
    echo "Frontend not running on port 3000."
fi

# Kill Ngrok
echo "Killing Ngrok..."
pkill -f "ngrok http 8000" || echo "Ngrok not running."

echo "✅ All Verifair processes stopped."
