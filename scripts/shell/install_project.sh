#!/bin/bash

# ─── Verifair — Dependency Installer ───

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR"

echo "Installing Verifair dependencies..."

# Python virtual environment
if [ ! -d "backend/venv" ]; then
    echo "  Creating Python virtual environment..."
    python3 -m venv backend/venv
else
    echo "  Found existing virtual environment."
fi

# Backend
echo "  Installing backend requirements..."
source backend/venv/bin/activate
pip install -r backend/requirements.txt

# Frontend
if [ -d "frontend" ]; then
    echo "  Installing frontend packages..."
    cd frontend
    npm install
    cd ..
else
    echo "  ERROR: frontend/ directory not found."
    exit 1
fi

echo "Installation complete. Run: ./scripts/shell/start_verifair.sh"
