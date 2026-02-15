#!/bin/bash

# Verifair Launcher for macOS
# This script opens a new Terminal window with tabs for Backend, Frontend, and Ngrok

echo "🚀 Launching Verifair..."

# Get the absolute path of the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# AppleScript to open tabs and run commands
osascript <<EOF
tell application "Terminal"
    activate
    # Create a new window
    do script "echo '🚀 Starting Backend...'; cd \"$PROJECT_DIR\"; source backend/venv/bin/activate; uvicorn backend.main:app --reload"
    
    # Rename the window/tab (cosmetic, might not work on all zsh but trying)
    tell front window to set custom title to "Verifair Backend"

    # Frontend Tab
    tell front window
        set newTab to do script "echo '🚀 Starting Frontend...'; cd \"$PROJECT_DIR/frontend\"; npm run dev"
    end tell

    # Ngrok Tab
    tell front window
        set newTab to do script "echo '🚀 Starting Ngrok Tunnel...'; cd \"$PROJECT_DIR\"; ngrok http 8000"
    end tell
end tell
EOF

echo "✅ Verifair launched in new Terminal tabs!"
