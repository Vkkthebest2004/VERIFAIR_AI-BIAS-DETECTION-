#!/bin/bash

# ─── Verifair Launcher (macOS) ───
# Opens a new Terminal window with tabs for Backend, Frontend, and Ngrok

echo "Starting Verifair..."

# Resolve the project root (two levels up from scripts/shell/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

osascript <<EOF
tell application "Terminal"
    activate
    # Backend
    do script "echo 'Starting Backend...'; cd \"$PROJECT_DIR\"; source backend/venv/bin/activate; uvicorn backend.main:app --reload"
    tell front window to set custom title to "Verifair Backend"

    # Frontend
    tell front window
        set newTab to do script "echo 'Starting Frontend...'; cd \"$PROJECT_DIR/frontend\"; npm run dev"
    end tell

    # Ngrok Tunnel
    tell front window
        set newTab to do script "echo 'Starting Ngrok Tunnel...'; cd \"$PROJECT_DIR\"; ngrok http 8000"
    end tell
end tell
EOF

echo "Verifair launched in new Terminal tabs."
