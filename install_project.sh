#!/bin/bash

echo "📦 Installing Verifair Dependencies..."

# Check if Python virtual environment exists
if [ ! -d "backend/venv" ]; then
    echo "Creating Python Virtual Environment..."
    python3 -m venv backend/venv
else
    echo "Found Python Virtual Environment."
fi

# Activate venv and install backend dependencies
echo "🐍 Installing Backend Requirements..."
source backend/venv/bin/activate
pip install -r backend/requirements.txt

# Install frontend dependencies
if [ -d "frontend" ]; then
    echo "⚛️ Installing Frontend Requirements (Node.js)..."
    cd frontend
    if [ ! -d "node_modules" ]; then
        echo "Installing npm modules..."
        npm install
    else
        echo "Updating npm modules..."
        npm install
    fi
    cd ..
else
    echo "❌ Frontend directory not found!"
fi

echo "✅ Installation Complete! Use ./start_verifair.sh to run app."
