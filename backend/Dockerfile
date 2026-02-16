# ─── Verifair Backend ───
FROM python:3.10-slim

WORKDIR /app

# System dependencies for pdfplumber, argon2, and general build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download NLTK data at build time
RUN python -c "import nltk; nltk.download('punkt_tab'); nltk.download('stopwords'); nltk.download('wordnet')"

# Copy backend code into /app/backend/ to preserve package imports
COPY . backend/

# Create __init__.py if missing (required for Python package resolution)
RUN touch backend/__init__.py

# Ensure Python output is unbuffered (visible in docker logs)
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/docs || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
