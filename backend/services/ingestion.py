
import pdfplumber
import re
from typing import List, Generator
import io
import logging
from backend.config.bias_config import CHUNK_SIZE

logger = logging.getLogger("VerifairIngestion")

class IngestionService:
    """
    Service responsible for handling file uploads (PDF) and preparing text for the Sentinel.
    """

    @staticmethod
    def extract_text_from_pdf(file_bytes: bytes) -> str:
        """
        Extracts raw text from a PDF file using pdfplumber.
        """
        text_content = []
        try:
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        text_content.append(text)
            
            full_text = "\n".join(text_content)
            logger.info(f"Extracted {len(full_text)} characters from PDF.")
            return full_text
        except Exception as e:
            logger.error(f"Error extracting PDF: {e}")
            raise ValueError(f"Failed to process PDF file: {str(e)}")

    @staticmethod
    def extract_text_from_raw(text: str) -> str:
        """
        Pass-through for raw text input, just ensures it's a string.
        """
        if not text:
            return ""
        logger.info(f"Received raw text input of length {len(text)}.")
        return text

    @staticmethod
    def clean_and_chunk_text(text: str, chunk_size: int = CHUNK_SIZE) -> List[str]:
        """
        Cleans text and breaks it into 'Context Windows' of specific sentence counts.
        
        Args:
            text: Raw text string.
            chunk_size: Number of sentences per chunk (from config).
        
        Returns:
            List of text chunks.
        """
        if not text:
            return []

        # 1. Clean whitespace: replace multiple spaces/newlines with single space
        cleaned_text = re.sub(r'\s+', ' ', text).strip()

        # 2. Split into sentences (simple regex for punctuation)
        # We split by (. ! ?) followed by a space or end of string.
        # This is a basic sentence splitter; for production consider spacy/nltk.
        sentences = re.split(r'(?<=[.!?])\s+', cleaned_text)
        
        # Filter empty strings
        sentences = [s.strip() for s in sentences if s.strip()]

        # 3. Create Context Windows (Chunks)
        chunks = []
        for i in range(0, len(sentences), chunk_size):
            # Join 'chunk_size' sentences together
            window = " ".join(sentences[i : i + chunk_size])
            chunks.append(window)

        logger.info(f"Created {len(chunks)} chunks from {len(sentences)} sentences.")
        return chunks
