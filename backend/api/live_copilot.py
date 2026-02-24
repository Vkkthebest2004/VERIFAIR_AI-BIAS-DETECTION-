"""
=============================================================================
  Live Copilot API — Real-Time Speech-to-Text Bias Analysis
=============================================================================

This module provides the WebSocket and REST endpoints for the Live Copilot
system. Unlike the existing live_audit.py which requires Whisper for audio
transcription, the Live Copilot receives TEXT directly from the browser's
Web Speech API (SpeechRecognition), enabling:

  - Zero backend dependency on Whisper for real-time mode
  - Millisecond Tier 1 heuristic analysis on every utterance
  - Fast Tier 2 deep BERT-ensemble analysis for flagged content
  - Speaker role identification
  - Scenario-aware analysis (meeting, interview, HR review)

Architecture:
  Browser (Web Speech API) → WebSocket (text) → Tier 1 (instant) →
  Tier 2 BERT (async, ~50-200ms, if flagged) → JSON response → Frontend nudge
"""

import uuid
import logging
import json
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel

# Import the decoupled analysis engine
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from analysis_engine.heuristic import HeuristicAnalyzer
from analysis_engine.bert_analyzer import BertCopilotAnalyzer
from analysis_engine.speaker_roles import SpeakerRoleDetector
from analysis_engine.scenario_config import ScenarioConfig

logger = logging.getLogger("LiveCopilot")
router = APIRouter()


# ── Pydantic Models ──

class CopilotAnalyzeRequest(BaseModel):
    """REST endpoint request body for one-shot analysis."""
    text: str
    scenario: str = "general"
    speaker: Optional[str] = None
    include_deep: bool = False


class CopilotAnalyzeResponse(BaseModel):
    """Response from the copilot analysis."""
    text: str
    tier1: Dict[str, Any]
    tier2: Optional[Dict[str, Any]] = None
    speaker_role: Optional[Dict[str, Any]] = None
    timestamp: str
    session_id: Optional[str] = None


class CopilotReportRequest(BaseModel):
    """Request body for generating an end-of-session report."""
    session_entries: List[Dict[str, Any]]
    scenario: str = "general"


# ── Shared BERT Analyzer Instance ──

_bert_analyzer: Optional[BertCopilotAnalyzer] = None
_bert_init_attempted = False

def get_bert_analyzer() -> Optional[BertCopilotAnalyzer]:
    """Lazy-initialize the BERT Copilot Analyzer (only once)."""
    global _bert_analyzer, _bert_init_attempted

    if _bert_init_attempted:
        return _bert_analyzer

    _bert_init_attempted = True

    try:
        _bert_analyzer = BertCopilotAnalyzer()
        if _bert_analyzer.is_available:
            logger.info(f"BERT Copilot Analyzer ready: {_bert_analyzer.model_name}")
        else:
            logger.warning("BERT Copilot Analyzer loaded but Sentinel unavailable")
            _bert_analyzer = None
    except Exception as e:
        logger.error(f"BERT Copilot Analyzer initialization failed: {e}")
        _bert_analyzer = None

    return _bert_analyzer


# ── WebSocket Connection Manager ──

class CopilotConnectionManager:
    """Manages active WebSocket connections for the Live Copilot."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.session_data: Dict[str, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        self.session_data[session_id] = {
            "connected_at": datetime.utcnow().isoformat(),
            "total_analyzed": 0,
            "total_flagged": 0,
            "history": [],
        }
        logger.info(f"Copilot client connected: {session_id}")

    def disconnect(self, session_id: str):
        self.active_connections.pop(session_id, None)
        self.session_data.pop(session_id, None)
        logger.info(f"Copilot client disconnected: {session_id}")

    def get_stats(self, session_id: str) -> Dict[str, Any]:
        return self.session_data.get(session_id, {})

    def update_stats(self, session_id: str, is_biased: bool):
        if session_id in self.session_data:
            self.session_data[session_id]["total_analyzed"] += 1
            if is_biased:
                self.session_data[session_id]["total_flagged"] += 1


copilot_manager = CopilotConnectionManager()


# ====================================================================
#  ENDPOINT 1: WebSocket — Real-Time Live Copilot
#  Receives TEXT from Web Speech API, returns instant bias analysis
# ====================================================================

@router.websocket("/ws/live-copilot")
async def websocket_copilot(websocket: WebSocket):
    """
    WebSocket endpoint for the Live Copilot.

    Protocol:
      Client sends JSON: {"text": "...", "scenario": "meeting", "speaker": "Speaker 1"}
      Server responds JSON: {tier1 results, tier2 results (if applicable), speaker_role}

    The client (browser) does speech-to-text via Web Speech API,
    then sends the recognized text here for bias analysis.
    """
    session_id = str(uuid.uuid4())[:8]
    await copilot_manager.connect(websocket, session_id)

    # Initialize BERT analyzer (lazy)
    bert = get_bert_analyzer()

    # Send connection confirmation
    await websocket.send_json({
        "type": "connected",
        "session_id": session_id,
        "bert_available": bert is not None and bert.is_available,
        "bert_models": bert.model_name if bert and bert.is_available else None,
        # Keep backward compat keys for frontend transition
        "llm_available": bert is not None and bert.is_available,
        "llm_model": bert.model_name if bert and bert.is_available else None,
        "scenarios": ScenarioConfig.list_scenarios(),
    })

    try:
        while True:
            # Receive text message from client
            raw_data = await websocket.receive_text()

            try:
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                # If plain text sent (not JSON), wrap it
                data = {"text": raw_data}

            text = data.get("text", "").strip()
            scenario = data.get("scenario", "general")
            speaker = data.get("speaker", None)

            if not text:
                await websocket.send_json({
                    "type": "silence",
                    "message": "No text received",
                })
                continue

            # ── TIER 1: Heuristic Analysis (instant, < 5ms) ──
            tier1_result = HeuristicAnalyzer.analyze(text, scenario)

            # ── Speaker Role Detection ──
            speaker_role = SpeakerRoleDetector.detect_role(text) if text else None

            # ── Build base response ──
            response = {
                "type": "analysis",
                "session_id": session_id,
                "text": text,
                "speaker": speaker,
                "speaker_role": speaker_role,
                "tier1": tier1_result,
                "tier2": None,
                "is_biased": tier1_result["is_biased"],
                "severity": tier1_result["severity"],
                "timestamp": datetime.utcnow().isoformat(),
            }

            # Send Tier 1 result IMMEDIATELY (for instant feedback)
            await websocket.send_json(response)

            # Update stats
            copilot_manager.update_stats(session_id, tier1_result["is_biased"])

            # ── TIER 2: Deep BERT Analysis (fast, ~50ms per utterance) ──
            if bert and bert.is_available:
                try:
                    # Run BERT analysis in thread pool to avoid blocking
                    loop = asyncio.get_event_loop()
                    tier2_result = await loop.run_in_executor(
                        None, bert.analyze, text, scenario
                    )

                    # Send Tier 2 result as a follow-up message
                    await websocket.send_json({
                        "type": "deep_analysis",
                        "session_id": session_id,
                        "text": text,
                        "tier2": tier2_result,
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                except Exception as e:
                    logger.error(f"Tier 2 BERT analysis error: {e}")
                    # Don't crash — Tier 1 already sent

    except WebSocketDisconnect:
        copilot_manager.disconnect(session_id)
    except Exception as e:
        logger.error(f"Copilot WebSocket error: {e}")
        copilot_manager.disconnect(session_id)


# ====================================================================
#  ENDPOINT 2: REST — One-Shot Analysis (for testing / non-realtime)
# ====================================================================

@router.post("/copilot/analyze")
async def analyze_text(request: CopilotAnalyzeRequest):
    """
    REST endpoint for one-shot bias analysis.
    Useful for testing or when WebSocket isn't needed.

    Runs Tier 1 always, Tier 2 only if include_deep=True.
    """
    # Tier 1
    tier1 = HeuristicAnalyzer.analyze(request.text, request.scenario)

    # Speaker Role
    speaker_role = SpeakerRoleDetector.detect_role(request.text)

    # Tier 2 (optional)
    tier2 = None
    if request.include_deep:
        bert = get_bert_analyzer()
        if bert and bert.is_available:
            loop = asyncio.get_event_loop()
            tier2 = await loop.run_in_executor(
                None, bert.analyze, request.text, request.scenario
            )

    return {
        "text": request.text,
        "tier1": tier1,
        "tier2": tier2,
        "speaker_role": speaker_role,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ====================================================================
#  ENDPOINT 3: REST — End of Session Report Generation
# ====================================================================

@router.post("/copilot/report")
async def generate_report(request: CopilotReportRequest):
    """
    Generate a comprehensive End-of-Session Speech Bias Report.
    Takes a list of all transcript entries and flags from the session.

    Uses BERT-based statistical aggregation — instant, no LLM dependency.
    """
    if not request.session_entries:
        raise HTTPException(status_code=400, detail="No session entries provided")

    bert = get_bert_analyzer()
    if not bert:
        # Fallback: basic statistical summary even without Sentinel
        total_flags = sum(1 for e in request.session_entries if e.get("is_biased"))
        total = len(request.session_entries)
        return {
            "overall_score": round(10 - min(10, (total_flags / total) * 50), 1) if total else 10,
            "summary": "BERT models not loaded. Basic statistics provided.",
            "primary_bias_patterns": [f"{total_flags} utterances flagged"],
            "speaker_dynamics": "Analysis unavailable without BERT models.",
            "key_suggestions": ["Ensure the backend has loaded BERT models for detailed coaching insights."],
            "basic_stats": {
                "total_entries": total,
                "total_flags": total_flags,
            },
            "model_used": "fallback_stats",
        }

    # Generate instant report via BERT statistical aggregation
    report = bert.generate_session_report(request.session_entries)

    if "error" in report:
        raise HTTPException(status_code=500, detail=report["error"])

    return report


# ====================================================================
#  ENDPOINT 4: GET — Available Scenarios
# ====================================================================

@router.get("/copilot/scenarios")
async def get_scenarios():
    """Return available analysis scenarios with their descriptions."""
    scenarios = {}
    for name, config in ScenarioConfig.SCENARIOS.items():
        scenarios[name] = {
            "persona": config["persona"],
            "focus_areas": config["focus_areas"],
        }
    return {"scenarios": scenarios}


# ====================================================================
#  ENDPOINT 5: GET — Copilot Status (health check)
# ====================================================================

@router.get("/copilot/status")
async def copilot_status():
    """Health check for the copilot system."""
    bert = get_bert_analyzer()

    return {
        "status": "operational",
        "tier1": "active",
        "tier2": "active" if (bert and bert.is_available) else "unavailable",
        "tier2_engine": "BERT Ensemble" if (bert and bert.is_available) else None,
        "bert_models": bert.model_name if (bert and bert.is_available) else None,
        "scenarios": ScenarioConfig.list_scenarios(),
        "active_connections": len(copilot_manager.active_connections),
    }
