# Changelog

All notable changes to the **Verifair** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.3.0] - 2026-02-17

### Added
- **Indian Context Bias Detection**: Added specific bias detection for Indian sociological contexts, including:
  - Caste Bias: Stereotypes related to caste and reservation.
  - Regional Bias: North vs South Indian stereotypes.
  - Colorism: Skin tone bias specific to the Indian subcontinent.
  - Religion: Expanded religious bias detection to include Hindu and Sikh contexts.
- **Docker Healthchecks**: Added `HEALTHCHECK` instructions to both backend and frontend Dockerfiles for improved container orchestration and reliability.

### Changed
- Updated `bias_config` with new identity terms and stereotype mappings for the Indian context.
- Unified versioning across backend and frontend to 3.3.0.

---

## [3.1.0] - 2025-02-15

### Added
- **Multi-Input Batch Analysis**: Upload and analyze multiple files and text inputs simultaneously with a unified batch summary.
- **Batch Executive Summary**: Aggregated statistics (total inputs, chunks, bias flags, hate speech) with an LLM-generated conclusion.
- **Source File Tagging**: Each result in a batch report is tagged with its source file for traceability.
- **HateSpeechPanel Component**: Interactive Plotly.js visualizations — gauge chart, bar chart, and radar chart for hate speech analysis.
- **TXT File Support**: Drag-and-drop and file upload now accept `.txt` files alongside PDF and CSV.
- **Test Inputs**: Sample hate speech and neutral text files for testing batch analysis.

### Changed
- Backend batch summary now includes **all individual results merged**, not just an empty array.
- Improved file validation: empty `UploadFile` entries from browsers are filtered out.
- Unknown file types fall back to text parsing instead of being silently skipped.
- Results page cards use smart border colors (red for biased, neutral for clean).
- Removed all emojis from the UI; replaced with plain text labels for a cleaner look.

### Fixed
- Critical bug: results with hate speech but no Z-score bias flags were hidden due to overly strict filtering.
- Batch summary `full_report_json` was not properly serialized (now uses `convert_numpy`).

---

## [3.0.0] - 2025-02-05

### Added
- **3-Layer Hate Speech Detection Engine**:
  - Layer 1: `unitary/toxic-bert` for toxicity classification.
  - Layer 2: `facebook/roberta-hate-speech-dynabench-r4-target` for explicit hate.
  - Layer 3: `tomh/toxigen_roberta` for implicit/coded hate.
  - Ensemble scoring with severity levels (Critical, High, Medium, Low, None).
- **Stereotype Detection**: 13-category StereoSet + CrowS-Pairs pattern matching with severity scoring.
- **Advice Disparity Analysis**: Detects differential treatment in advice/recommendations across demographic groups.
- **WEAT/SEAT Bias Tests**: Word Embedding Association Test and Sentence Embedding Association Test for statistical bias measurement.
- **Advanced Embeddings**: Upgraded to `sentence-transformers/all-mpnet-base-v2` for higher quality semantic analysis.
- **Selection Bias Module**: Fairlearn-based demographic parity analysis with Four-Fifths Rule violation detection.
- **LLM-Powered Explanations**: Llama 3.2 integration for human-readable bias explanations.

### Changed
- Upgraded from basic cosine similarity to full Z-score statistical analysis.
- Enhanced frontend with glassmorphism design, dark mode, and interactive charts.

---

## [2.0.0] - 2025-01-29

### Added
- **Full-Stack Architecture**: FastAPI backend + Next.js frontend.
- **User Authentication**: JWT-based login/register with secure password hashing.
- **PDF & CSV Ingestion**: Upload and extract text from PDF documents and CSV files.
- **Sentence-Level Bias Analysis**: Chunk text into sentences and analyze each for bias.
- **Audit History**: Persistent storage of all analysis results with SQLite.
- **Interactive UI**: Professional dashboard with charts, sensitivity slider, and result cards.
- **API Endpoints**: RESTful API with authentication, audit, and history routes.

---

## [1.0.0] - 2025-01-29

### Added
- Initial release of Verifair: AI Bias Detection Platform.
- Core bias detection using sentence-transformers and cosine similarity.
- Basic project structure with Python backend.
- README and project documentation.

---

[3.1.0]: https://github.com/Vkkthebest2004/VERIFAIR_AI-BIAS-DETECTION-/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/Vkkthebest2004/VERIFAIR_AI-BIAS-DETECTION-/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/Vkkthebest2004/VERIFAIR_AI-BIAS-DETECTION-/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Vkkthebest2004/VERIFAIR_AI-BIAS-DETECTION-/releases/tag/v1.0.0
