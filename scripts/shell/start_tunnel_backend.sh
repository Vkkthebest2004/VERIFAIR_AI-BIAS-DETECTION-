#!/bin/bash

# ─── Verifair — Backend + Ngrok Tunnel ───
# Starts backend and creates a public ngrok tunnel for Vercel frontend

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR"

# Kill existing processes
pkill -f "uvicorn backend.main:app"
pkill ngrok

echo "Starting backend..."
source backend/venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
echo "  Backend running (PID: $BACKEND_PID)"

echo "Starting ngrok tunnel..."
ngrok http 8000 > /dev/null 2>&1 &
NGROK_PID=$!

# Wait for ngrok to initialize
sleep 3

NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o 'https://[^"]*ngrok-free.app')

if [ -z "$NGROK_URL" ]; then
    echo "  Failed to get ngrok URL. Is ngrok authenticated?"
    echo "  Run: ngrok config add-authtoken <your-token>"
    kill $BACKEND_PID
    exit 1
fi

echo ""
echo "Backend and tunnel are live."
echo "───────────────────────────────────────────────"
echo "  Backend Local:  http://localhost:8000"
echo "  Public URL:     $NGROK_URL"
echo "───────────────────────────────────────────────"
echo ""
echo "Next steps:"
echo "  1. Go to Vercel Project Settings -> Environment Variables"
echo "  2. Set NEXT_PUBLIC_API_URL to: $NGROK_URL"
echo "  3. Redeploy your frontend on Vercel."
echo ""
echo "Press Ctrl+C to stop servers."

wait $BACKEND_PID
