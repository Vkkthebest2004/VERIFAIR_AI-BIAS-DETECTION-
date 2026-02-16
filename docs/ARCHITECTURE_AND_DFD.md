# Verifair System Architecture & Data Flow

## 📊 Data Flow Diagrams (DFD)

### Level 0: Context Diagram
*The high-level interaction between the User and the Verifair System.*

```mermaid
graph LR
    User[HR Auditor / User] -- Uploads PDF/CSV --> Verifair[Verifair System]
    User -- Authentication --> Verifair
    Verifair -- "Bias Report (Dashboard)" --> User
    Verifair -- "Selection Analysis" --> User
    EEOC[EEOC Guidelines] -. "Compliance Rules" .-> Verifair
```

### Level 1: System Flow
*The core flow of data through the Backend API and AI Engine.*

```mermaid
graph TD
    User((User)) -->|HTTPS| Frontend[Next.js Frontend]
    Frontend -->|JWT Auth| API[FastAPI Backend]
    
    subgraph "Backend Services"
        API -->|1. Ingest| Ingestion[Ingestion Service]
        Ingestion -->|Text/PDF| Cleaner[Text Cleaner]
        Cleaner -->|Chunks| Sentinel[Sentinel AI Engine]
        
        Sentinel -->|2. Vectorize| Embedder[MPNet Embeddings]
        Sentinel -->|3. Detect| Ensemble[Ensemble Models]
        
        subgraph "AI Models"
            Ensemble --> ToxicBERT[Toxic-BERT]
            Ensemble --> RoBERTa[RoBERTa Hate]
            Ensemble --> StereoSet[StereoSet Lexicon]
            Ensemble --> ZScore[Z-Score Calc]
        end
        
        Ensemble -->|Flags| Reporter[Reporting Service]
        Reporter -->|JSON| DB[(SQLite Database)]
    end
    
    DB -->|History| API
    Reporter -->|4. Response| Frontend
```

### Level 2: Bias Detection Logic (Detailed)
*The internal physics of the Sentinel Engine.*

```mermaid
flowchart LR
    Input[Text Chunk] --> Embed[Generate Embedding]
    
    subgraph "Statistical Path"
        Embed --> Cosine[Cosine Similarity]
        Cosine --> Concepts[Target Concepts]
        Concepts --> ZCalc[Z-Score Calculation]
        ZCalc -- "|z| > 2.0" --> Flag[Bias Flag]
    end
    
    subgraph "Neural Path"
        Input --> Toxic[Toxicity Classifier]
        Input --> Hate[Hate Speech Classifier]
        Input --> Implicit[Implicit Bias Detector]
        Toxic & Hate & Implicit --> Severity[Severity Scorer]
    end
    
    Flag & Severity --> Aggregator[Result Aggregator]
    Aggregator --> Report[Final JSON Report]
```

---

## 🏗️ Master Build Prompt (The "peokpt")
*Use this detailed prompt to instruct an AI or developer to build Verifair from scratch.*

**Role:** Expert Full-Stack AI Engineer
**Task:** Architecture & Development of "Verifair" - An AI Bias Audit Platform

**1. Core Objective:**
Build a secure, enterprise-grade web application to detect, quantify, and report on bias in unstructured text (PDFs) and structured selection data (CSVs). The system must use **latent semantic analysis** (not just keywords) and comply with **EEOC statistical standards**.

**2. Technology Stack:**
*   **Backend:** Python 3.10+, FastAPI (Async), Pydantic.
*   **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4.
*   **Database:** SQLite (local/dev) or PostgreSQL (prod) with SQLAlchemy ORM.
*   **AI/ML:** `sentence-transformers` (all-mpnet-base-v2), `pytorch`, `scikit-learn`, `scipy`.
*   **DevOps:** Docker Compose (multi-container), Github Actions.

**3. Key Features & Implementation Rules:**

*   **A. The "Sentinel" Engine (Text Bias):**
    *   Ingest PDFs/Text and chunk into 3-sentence windows.
    *   Generate embeddings using `all-mpnet-base-v2`.
    *   **Z-Score Analysis:** Compare chunk embeddings against "Identity Terms" (e.g., gender, race) and "Target Concepts" (e.g., unpleasant, incompetent). If statistical distance (Z-score) > 2.0, flag as biased.
    *   **Hate Speech Ensemble:** Implement a 3-layer check using:
        1.  `unitary/toxic-bert` (Toxicity)
        2.  `facebook/roberta-hate-speech` (Explicit Hate)
        3.  `toxigen_roberta` (Implicit/Coded Hate)
    *   **Stereotype Check:** Match against a lexicon of 13+ categories (Gender, Race, Age) using cosine similarity.

*   **B. Selection Bias Module (Structured Data):**
    *   Accept CSVs with columns: `Candidate_ID`, `Identity_Group`, `Selected (0/1)`.
    *   **Four-Fifths Rule:** Calculate selection rate for each group. If `(Minority Rate / Majority Rate) < 0.8`, flag as **EEOC Violation**.
    *   **Significance Testing:** Run a Chi-Square test (p < 0.05) to prove the disparity is not random.

*   **C. Frontend Dashboard:**
    *   **Design:** Glassmorphism, Dark/Light mode, "Apple-eque" aesthetic.
    *   **Visualizations:**
        *   **Bias Radar:** Radar chart showing bias intensity across 5+ identity axes.
        *   **Severity Gauge:** Real-time meter for the document's toxicity.
    *   **Interaction:** Drag-and-drop file upload, instant analysis results.

*   **D. Reporting:**
    *   Generate a "Collective Report" JSON for batch uploads.
    *   Include an "Fairness Score" (0-100) based on inverse bias frequency.

**4. Quality & Constraints:**
*   Code must be strictly typed (MyPy/TypeScript).
*   Use Async/Await for all I/O operations.
*   Include comprehensive logging (`logging.getLogger`).
*   Ensure the system can run offline (download models on first run).
