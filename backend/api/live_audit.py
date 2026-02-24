import os
import uuid
import logging
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from backend.core.sentinel_registry import get_sentinel
from backend.core.database import get_db
from backend.services.ingestion import IngestionService
from backend.core.explainer import ExplainerService
from backend.core.models import User, AuditRecord
from backend.api.auth import get_current_user
import numpy as np

try:
    from faster_whisper import WhisperModel
    import tempfile
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False

logger = logging.getLogger("LiveAudit")
router = APIRouter()

# Lazy-loaded Whisper model — only loaded on first use
_whisper_model = None

def get_whisper_model():
    """Lazy-load Whisper model on first use instead of at server startup."""
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model
    if not WHISPER_AVAILABLE:
        logger.error("faster-whisper is not installed.")
        return None
    try:
        logger.info("Loading Whisper model (small.en) on first use...")
        _whisper_model = WhisperModel("small.en", device="cpu", compute_type="int8")
        logger.info("Whisper model loaded successfully.")
        return _whisper_model
    except Exception as e:
        logger.error(f"Failed to load Whisper model: {e}")
        return None


def convert_numpy(obj):
    """Recursively convert numpy types to native Python for JSON serialization."""
    if isinstance(obj, dict):
        return {k: convert_numpy(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy(i) for i in obj]
    elif isinstance(obj, (np.bool_,)):
        return bool(obj)
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating, float)):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return [convert_numpy(i) for i in obj.tolist()]
    return obj


def _transcribe_audio_file(file_path: str) -> str:
    """Transcribe an audio file to text using Whisper."""
    whisper_model = get_whisper_model()
    if not whisper_model:
        raise RuntimeError("Whisper model is not available.")
    
    segments, _info = whisper_model.transcribe(file_path, beam_size=3)
    text = " ".join([segment.text for segment in segments]).strip()
    return text


# ====================================================================
#  ENDPOINT 1: Full Audio Upload → Complete Audit Report
#  Same quality output as text/CSV uploads
# ====================================================================

@router.post("/audit-audio", response_model=List[Dict[str, Any]])
async def audit_audio(
    audio: UploadFile = File(...),
    context: Optional[str] = Form(default="General"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Full audio-to-report pipeline:
    1. Receive recorded audio file
    2. Transcribe with Faster-Whisper (small.en)
    3. Chunk transcript and run through VerifairSentinel
    4. Generate LLM explanations for flagged items
    5. Save to database and return full report (same as /audit)
    """
    sentinel = get_sentinel()
    if not sentinel:
        raise HTTPException(status_code=503, detail="Bias Detection Engine not initialized.")
    
    if not WHISPER_AVAILABLE:
        raise HTTPException(status_code=503, detail="Audio transcription engine (faster-whisper) not available.")
    
    # Save uploaded audio to temp file
    temp_audio_path = None
    try:
        audio_bytes = await audio.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file received.")
        
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_audio:
            temp_audio.write(audio_bytes)
            temp_audio_path = temp_audio.name
        
        # 1. TRANSCRIBE — Full audio to text
        logger.info(f"Transcribing audio file ({len(audio_bytes)} bytes)...")
        transcript = _transcribe_audio_file(temp_audio_path)
        
        if not transcript or not transcript.strip():
            raise HTTPException(status_code=400, detail="No speech detected in the audio recording.")
        
        logger.info(f"Transcription complete: {len(transcript)} characters, ~{len(transcript.split())} words")
        
        # 2. CHUNK & ANALYZE — Same pipeline as /audit endpoint
        text_chunks = IngestionService.clean_and_chunk_text(transcript)
        analysis_results = sentinel.batch_analyze(text_chunks)
        
        # 3. LLM EXPLANATIONS — Generate for flagged items
        for res in analysis_results:
            if res["is_biased"]:
                flagged_ids = [f["identity"] for f in res["bias_flags"]]
                z_scores = [f["z_score"] for f in res["bias_flags"]]
                explanation = await ExplainerService.explain_bias(
                    res["text_snippet"], flagged_ids, z_scores, context=context
                )
                res["explanation"] = explanation
        
        total_flags = sum(1 for res in analysis_results if res["is_biased"])
        
        filename = f"Live Audio Recording {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
        
        response_data = {
            "filename": filename,
            "total_sentences_analyzed": len(text_chunks),
            "bias_flags_count": total_flags,
            "transcript": transcript,
            "results": analysis_results,
        }
        
        # 4. SAVE TO DATABASE — Same as /audit
        new_record = AuditRecord(
            filename=filename,
            total_sentences=len(text_chunks),
            bias_flags_count=total_flags,
            full_report_json=convert_numpy(json.loads(json.dumps(response_data, default=str))),
            owner=current_user
        )
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        
        # Return with record_id so frontend can navigate to /results/{id}
        response_data["record_id"] = new_record.id
        
        return [convert_numpy(response_data)]
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Audio audit error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process audio: {str(e)}")
    finally:
        # Cleanup temp file
        if temp_audio_path and os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)


# ====================================================================
#  ENDPOINT 2: Real-Time WebSocket (Live Co-Pilot nudges)
# ====================================================================

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

manager = ConnectionManager()

@router.websocket("/ws/live-audit")
async def websocket_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    """
    WebSocket endpoint for real-time audio bias nudges (co-pilot mode).
    Receives binary audio chunks, transcribes them, analyzes for bias,
    and returns JSON results in real time.
    """
    await manager.connect(websocket)
    session_id = str(uuid.uuid4())[:8]
    logger.info(f"WebSocket Client Connected: {session_id}")

    whisper_model = get_whisper_model()
    sentinel = get_sentinel()

    if not whisper_model or not sentinel:
        await websocket.send_json({"error": "Real-time analysis models are not initialized on the server."})
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive_bytes()
            
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_audio:
                temp_audio.write(data)
                temp_audio_path = temp_audio.name
                
            try:
                segments, _info = whisper_model.transcribe(
                    temp_audio_path, 
                    beam_size=1, 
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=500)
                )
                text = " ".join([segment.text for segment in segments]).strip()
                
                if not text:
                    await websocket.send_json({"status": "silence", "message": "No speech detected in chunk."})
                    continue
                
                analysis_results = sentinel.batch_analyze([text])
                
                result_payload = {
                    "status": "success",
                    "text": text,
                    "analysis": analysis_results[0] if analysis_results else None
                }
                
                await websocket.send_json(result_payload)
                
            except Exception as process_err:
                logger.error(f"Error processing audio chunk: {process_err}")
                await websocket.send_json({"status": "error", "message": str(process_err)})
            finally:
                if os.path.exists(temp_audio_path):
                    os.remove(temp_audio_path)
                    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"WebSocket Client Disconnected: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
        manager.disconnect(websocket)
