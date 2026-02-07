# Verifair: AI Bias Detection Platform

Verifair is an enterprise-grade AI governance platform designed to detect and visualize bias in unstructured text and structured selection processes. By leveraging **State-of-the-Art (SOTA)** Large Language Models (LLMs) and rigorous statistical frameworks, Verifair transforms subjective fairness auditing into a quantifiable, data-driven engineering discipline.

![Verifair Dashboard](https://via.placeholder.com/800x400?text=Verifair+Dashboard+Preview)

##  Features

-  Document Ingestion**: Seamlessly ingest PDF and CSV files with automatic text cleaning and context-aware chunking.
-  Semantic Bias Sentinel**: Uses `all-mpnet-base-v2` to analyze the **semantic latent space** of text, detecting implicit bias beyond simple keyword matching.
- Statistical Fairness Auditor**: Implements **EEOC-compliant metrics** (Four-Fifths Rule, Disparate Impact) to certify algorithmic fairness.
- Toxicity & Stereotype Detection**: Integrates `unitary/toxic-bert` and custom stereotype lexicons to flag hate speech and subtle prejudices.
-  Explainable AI (XAI)**: Provides human-readable explanations for every flagged anomaly, bridging the gap between technical metrics and business stakeholders.
-  Real-Time Governance**: Interactive dashboard with sensitivity sliders and live bias radar visualization.

##  Technology Stack

| Component | Tech |
|-----------|------|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion |
| **Backend** | Python 3.10+, FastAPI, Pydantic, NumPy, SciPy |
| **AI Core** | `sentence-transformers`, `fairlearn`, `scikit-learn` |
| **Infrastructure** | Docker, Docker Compose, Redis |

##  Getting Started

The recommended way to run Verifair is using **Docker Compose** for a consistent, production-like environment.

### Prerequisites

- **Docker Desktop** installed and running.

### Quick Start

1. Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/verifair.git
   cd verifair
   ```

2. Run Services**:
   ```bash
   docker-compose up --build
   ```

3. Access the Application**:
   - **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
   - **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

*Note: The first run may take a few minutes as it downloads the AI models (approx. 400MB).*

##  Manual Development Setup

If you prefer to run services individually without Docker:

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

##  Project Structure

```
VERIFAIR/
├── backend/            # FastAPI ML Application
│   ├── api/            # API Routes
│   ├── core/           # Bias Detection Logic (Sentinel & Auditor)
│   ├── services/       # Ingestion & Processing
│   └── config/         # Configuration & Constants
├── frontend/           # Next.js Dashboard
│   ├── app/            # App Router Pages
│   ├── components/     # UI Components
│   └── lib/            # Utilities & Hooks
├── data/               # Sample Datasets
├── docker-compose.yml  # Container Orchestration
└── README.md
```

##  Configuration

Verifair is strictly configured to follow industry standards but is fully customizable.

- **Bias Logic**: Modify `backend/config/bias_config.py` to adjust `IDENTITIES`, `TARGET_CONCEPTS`, and `SENSITIVITY_THRESHOLD`.
- **Chunk Size**: Adjust text processing granularity in `backend/config/bias_config.py`.

##  License

MIT License. Built for ethical AI auditing.
