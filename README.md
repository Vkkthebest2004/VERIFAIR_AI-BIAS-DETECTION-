# Verifair — AI Bias Detection Platform

Verifair is an enterprise-grade AI governance platform designed to detect and visualize bias in unstructured text and structured selection processes. It leverages **state-of-the-art** NLP models and rigorous statistical frameworks to transform subjective fairness auditing into a quantifiable, data-driven engineering discipline.

## Core Capabilities

- **Document Ingestion** — Seamlessly ingest PDF and CSV files with automatic text cleaning and context-aware chunking.
- **Semantic Bias Sentinel** — Uses `all-mpnet-base-v2` to analyze the semantic latent space of text, detecting implicit bias beyond simple keyword matching.
- **Statistical Fairness Auditor** — Implements EEOC-compliant metrics (Four-Fifths Rule, Disparate Impact) to certify algorithmic fairness.
- **Toxicity & Stereotype Detection** — Integrates `unitary/toxic-bert` and custom stereotype lexicons to flag hate speech and subtle prejudices.
- **Resume Forensics** — 6-module deep analyzer for hiring bias: qualification-controlled bias, name-proxy detection, college pedigree analysis, language disparity, skill-outcome mismatch, and experience penalty.
- **Explainable AI (XAI)** — Provides human-readable, context-aware explanations for every flagged anomaly via local LLM (Ollama / Llama 3.2).
- **Real-Time Governance** — Interactive dashboard with bias radar visualization and audit history.

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16, TypeScript, Tailwind CSS, Recharts |
| **Backend** | Python 3.10+, FastAPI, Pydantic, NumPy, SciPy, Pandas |
| **AI / ML** | `sentence-transformers`, `transformers`, `torch`, `fairlearn`, `scikit-learn` |
| **LLM** | Ollama (Llama 3.2) for natural-language explanations |
| **Infrastructure** | Docker, Docker Compose, SQLite |

## Getting Started

### Option A — Docker (Recommended)

```bash
git clone https://github.com/Vkkthebest2004/VERIFAIR_AI-BIAS-DETECTION-.git
cd VERIFAIR_AI-BIAS-DETECTION-
docker-compose up --build
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000/docs](http://localhost:8000/docs)

> First run downloads AI models (~400 MB).

### Option B — Manual Setup

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend (new terminal)
cd frontend
npm install && npm run dev
```

### Option C — One-Click Scripts (macOS)

```bash
./scripts/shell/install_project.sh   # one-time setup
./scripts/shell/start_verifair.sh    # launches everything
./scripts/shell/stop_verifair.sh     # clean shutdown
```

## Project Structure

```
VERIFAIR/
│
├── backend/                         # FastAPI + ML Engine
│   ├── main.py                      # Application entry point
│   ├── api/
│   │   ├── auth.py                  # JWT authentication
│   │   └── routes.py                # All REST endpoints
│   ├── core/
│   │   ├── sentinel.py              # Bias detection engine (7-layer)
│   │   ├── selection_bias.py        # Statistical fairness tests
│   │   ├── resume_bias_analyzer.py  # Resume forensics (6 modules)
│   │   ├── resume_parser.py         # PDF resume parser
│   │   ├── explainer.py             # LLM explanation service
│   │   ├── reporting.py             # Collective report generator
│   │   ├── database.py              # SQLAlchemy setup
│   │   ├── models.py                # ORM models
│   │   └── security.py              # Password hashing
│   ├── config/
│   │   └── bias_config.py           # Identity terms, thresholds, model names
│   ├── services/
│   │   └── ingestion.py             # Text extraction & chunking
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                        # Next.js UI
│   ├── app/
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Auth redirect
│   │   ├── globals.css              # Design system
│   │   ├── dashboard/               # Main dashboard
│   │   ├── landing/                 # Public landing page
│   │   ├── login/                   # Auth page
│   │   ├── results/[record_id]/     # Audit result details
│   │   ├── resume-forensics/        # Resume bias analysis
│   │   └── selection-bias/          # Statistical bias testing
│   ├── components/
│   │   ├── BiasRadar.tsx            # Radar chart visualization
│   │   ├── CollectiveReport.tsx     # Batch audit report
│   │   ├── DragDropUpload.tsx       # File upload component
│   │   ├── HateSpeechPanel.tsx      # Hate speech results
│   │   ├── SelectionBiasReport.tsx  # Selection bias results
│   │   └── ui/                      # Primitives (button, card, tabs)
│   ├── lib/
│   │   ├── api.ts                   # API base URL
│   │   ├── auth.tsx                 # Auth context & hooks
│   │   ├── theme.tsx                # Dark/light theme
│   │   └── utils.ts                 # Utilities
│   ├── public/                      # Logo, hero image, login video
│   └── Dockerfile
│
├── docs/                            # Documentation
│   ├── ARCHITECTURE_AND_DFD.md      # System architecture & data flow
│   ├── CHANGELOG.md                 # Version history
│   ├── HACKATHON_GUIDE.md           # Presentation guide
│   ├── LEARNING_CHEAT_SHEET.md      # Technical reference
│   └── RESUME_FORENSICS_GUIDE.md    # Resume module deep-dive
│
├── scripts/
│   ├── shell/                       # Startup & deployment scripts
│   │   ├── start_verifair.sh
│   │   ├── stop_verifair.sh
│   │   ├── install_project.sh
│   │   └── start_tunnel_backend.sh
│   └── testing/                     # Test suites
│       ├── test_backend.py          # Comprehensive backend tests
│       ├── generate_test_resumes.py # Test data generator
│       ├── verify_selection_bias.py # Selection bias verifier
│       └── fixtures/                # Sample input files
│
├── README.md                        # This file
├── QUICKSTART.md                    # Setup instructions
├── docker-compose.yml               # Container orchestration
└── .gitignore
```

## Configuration

- **Bias Parameters** — `backend/config/bias_config.py` controls identity terms, target concepts, sensitivity thresholds, and model selection.
- **Audit Context** — The dashboard allows selecting document context (Job Description, Performance Review, etc.) to tailor LLM explanations.

## License

MIT License. Built for ethical AI auditing.
