# Verifair — Quick Start Guide

Get the Verifair frontend and backend running in minutes.

## Prerequisites

Make sure you have these installed:
-   **Python 3.9+** — `python3 --version`
-   **Node.js 18+** — `node --version`
-   **Ngrok** *(optional, for public URLs)* — `brew install ngrok`

## One-Time Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/Vkkthebest2004/VERIFAIR_AI-BIAS-DETECTION-.git
    cd VERIFAIR_AI-BIAS-DETECTION-
    ```

2.  **Run the Installer Script:**
    This automatically sets up your Python virtual environment and installs all dependencies.
    ```bash
    chmod +x scripts/shell/install_project.sh
    ./scripts/shell/install_project.sh
    ```

## Start the Application

```bash
chmod +x scripts/shell/start_verifair.sh   # first time only
./scripts/shell/start_verifair.sh
```

This opens a new Terminal window with tabs for:
1.  **Frontend** — `http://localhost:3000`
2.  **Backend** — `http://localhost:8000`
3.  **Ngrok Tunnel** — public URL *(if installed)*

## Stop the Application

Close the Terminal window, or run:
```bash
./scripts/shell/stop_verifair.sh
```

## Project Structure

```
VERIFAIR/
├── README.md                    # Project overview
├── QUICKSTART.md                # This file
├── docker-compose.yml           # Container orchestration
│
├── backend/                     # FastAPI + ML Engine
│   ├── main.py                  # App entry point
│   ├── api/                     # REST endpoints & auth
│   ├── core/                    # Sentinel engine, analyzers, models
│   ├── config/                  # Bias config & parameters
│   ├── services/                # Ingestion & utilities
│   └── requirements.txt
│
├── frontend/                    # Next.js UI
│   ├── app/                     # Pages (dashboard, results, etc.)
│   ├── components/              # Reusable UI components
│   ├── lib/                     # API client, auth, theme
│   └── public/                  # Static assets (logo, media)
│
├── docs/                        # All documentation
│   ├── ARCHITECTURE_AND_DFD.md
│   ├── CHANGELOG.md
│   ├── HACKATHON_GUIDE.md
│   ├── LEARNING_CHEAT_SHEET.md
│   └── RESUME_FORENSICS_GUIDE.md
│
└── scripts/
    ├── shell/                   # Start / stop / install scripts
    └── testing/                 # Test suites & fixtures
        └── fixtures/            # Sample input data (CSVs, PDFs, etc.)
```

---
*Verifair — Algorithmic Bias Audit Platform*
