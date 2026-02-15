
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (needed for some python packages like pdfplumber/mupdf)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# We copy the entire local backend directory into /app/backend
# This preserves the "backend" package structure so imports work
COPY . backend/

# Download NLTK data (needed for text processing)
RUN python -m nltk.downloader punkt stopwords wordnet

# Environment variable to ensure python output is sent straight to terminal
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
