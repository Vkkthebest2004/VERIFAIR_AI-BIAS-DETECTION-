"""
=============================================================================
  Tier 2: Deep Contextual LLM Analyzer via Ollama
=============================================================================

Heavy, LLM-powered engine that analyzes text holistically to detect:
  - Indirect bias
  - Idea appropriation
  - Silencing patterns
  - Microaggressions
  - Coded language

Uses "Scenario-Aware Prompt Engineering" and "Defensive LLM Output Parsing"
methodologies:
  - Zero-Shot Prompt Constraints with hardcoded JSON skeletons
  - Cascading Regex Extractors to strip markdown filler
  - Dynamic model auto-discovery via Ollama tag scanning
"""

import re
import json
import logging
import httpx
from typing import Dict, Any, Optional, List

from analysis_engine.scenario_config import ScenarioConfig

logger = logging.getLogger("VerifairLLMAnalyzer")

# Preferred models in order of priority for auto-discovery
PREFERRED_MODELS = [
    "gemma3",       # Google's Gemma 3
    "gemma2",       # Google's Gemma 2
    "llama3.2",     # Meta LLaMA 3.2
    "llama3.1",     # Meta LLaMA 3.1
    "llama3",       # Meta LLaMA 3
    "mistral",      # Mistral
    "phi3",         # Microsoft Phi-3
]


class LLMAnalyzer:
    """
    Tier 2: Deep contextual analysis using local LLM via Ollama.
    
    Features:
      - Dynamic model auto-discovery (scans Ollama tags)
      - Scenario-aware prompt construction
      - Defensive output parsing with cascading regex extractors
      - Fully async via httpx
    """

    def __init__(self, ollama_host: str = "http://localhost:11434"):
        self.ollama_host = ollama_host
        self._model_name: Optional[str] = None
        self._available = False

    async def initialize(self) -> bool:
        """
        Dynamically discover the best available LLM model.
        Scans Ollama's local tags and selects the highest-priority model.
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.ollama_host}/api/tags")
                if response.status_code != 200:
                    logger.warning("Ollama not reachable for model discovery")
                    self._available = False
                    return False
                
                data = response.json()
                available_models = [
                    m.get("name", "").split(":")[0].lower()
                    for m in data.get("models", [])
                ]
                
                logger.info(f"Ollama models available: {available_models}")
                
                # Select the best model from our preference list
                for preferred in PREFERRED_MODELS:
                    if preferred in available_models:
                        self._model_name = preferred
                        self._available = True
                        logger.info(f"Selected LLM model: {self._model_name}")
                        return True
                
                # If none of our preferred models found, use the first available
                if available_models:
                    self._model_name = available_models[0]
                    self._available = True
                    logger.info(f"Using fallback model: {self._model_name}")
                    return True
                
                logger.warning("No models found in Ollama")
                self._available = False
                return False
                
        except httpx.ConnectError:
            logger.warning("Cannot connect to Ollama — LLM analysis unavailable")
            self._available = False
            return False
        except Exception as e:
            logger.error(f"Model discovery failed: {e}")
            self._available = False
            return False

    @property
    def is_available(self) -> bool:
        return self._available

    @property
    def model_name(self) -> Optional[str]:
        return self._model_name

    async def analyze(
        self, text: str, scenario: str = "general", timeout: float = 20.0
    ) -> Dict[str, Any]:
        """
        Run deep contextual bias analysis on text using the local LLM.
        
        Uses scenario-aware prompts and defensive output parsing.
        """
        if not self._available or not self._model_name:
            return {
                "tier": 2,
                "available": False,
                "error": "LLM not available — install Ollama and pull a model",
            }

        prompt = ScenarioConfig.get_prompt(text, scenario)

        payload = {
            "model": self._model_name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,  # Low temp for structured output
                "num_predict": 512,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.ollama_host}/api/generate", json=payload
                )

                if response.status_code != 200:
                    logger.warning(f"LLM returned status {response.status_code}")
                    return {
                        "tier": 2,
                        "available": True,
                        "error": f"LLM returned HTTP {response.status_code}",
                    }

                raw_response = response.json().get("response", "")
                parsed = self._defensive_parse(raw_response)

                if parsed:
                    parsed["tier"] = 2
                    parsed["model_used"] = self._model_name
                    return parsed
                else:
                    return {
                        "tier": 2,
                        "available": True,
                        "error": "Failed to parse LLM response",
                        "raw_response": raw_response[:500],
                    }

        except httpx.ReadTimeout:
            logger.warning("LLM analysis timed out")
            return {"tier": 2, "available": True, "error": "LLM analysis timed out"}
        except httpx.ConnectError:
            logger.warning("Lost connection to Ollama during analysis")
            return {"tier": 2, "available": False, "error": "Ollama connection lost"}
        except Exception as e:
            logger.error(f"LLM analysis error: {e}")
            return {"tier": 2, "available": True, "error": str(e)}

    def _defensive_parse(self, raw: str) -> Optional[Dict[str, Any]]:
        """
        Defensive LLM Output Parsing — Cascading Regex Extractors.
        
        Because LLMs are non-deterministic, this uses:
        1. Direct JSON.loads attempt
        2. Markdown code block extraction (```json ... ```)
        3. Brace-matching regex extraction
        4. Conversational filler stripping
        """
        if not raw or not raw.strip():
            return None

        raw = raw.strip()

        # ── Attempt 1: Direct parse ──
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        # ── Attempt 2: Extract from markdown code block ──
        md_pattern = re.compile(r"```(?:json)?\s*\n?(.*?)\n?```", re.DOTALL)
        md_match = md_pattern.search(raw)
        if md_match:
            try:
                return json.loads(md_match.group(1).strip())
            except json.JSONDecodeError:
                pass

        # ── Attempt 3: Find the first { ... } block via brace matching ──
        brace_start = raw.find("{")
        if brace_start != -1:
            depth = 0
            for i in range(brace_start, len(raw)):
                if raw[i] == "{":
                    depth += 1
                elif raw[i] == "}":
                    depth -= 1
                    if depth == 0:
                        candidate = raw[brace_start : i + 1]
                        try:
                            return json.loads(candidate)
                        except json.JSONDecodeError:
                            break

        # ── Attempt 4: Strip common conversational filler then retry ──
        filler_patterns = [
            r"^(?:Sure|Here|Okay|Of course|Let me|I'll)[^{]*",
            r"^[^{]*(?:result|analysis|output|response)\s*[:=]\s*",
        ]
        stripped = raw
        for fp in filler_patterns:
            stripped = re.sub(fp, "", stripped, flags=re.IGNORECASE).strip()
        
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            pass

        logger.warning(f"All parsing attempts failed for LLM response: {raw[:200]}")
        return None

    async def analyze_speaker_context(
        self, text: str, speaker_label: str, scenario: str = "general"
    ) -> Dict[str, Any]:
        """
        Analyze text with speaker context for richer analysis.
        Adds speaker role information to the prompt.
        """
        enriched_text = f"[Speaker: {speaker_label}] {text}"
        return await self.analyze(enriched_text, scenario)

    async def generate_session_report(
        self, session_entries: List[Dict[str, Any]], timeout: float = 45.0
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive End-of-Session report based on accumulated entries.
        Formats the entries into a transcript and runs the 'speech_report' scenario.
        """
        if not self._available or not self._model_name:
            return {
                "available": False,
                "error": "LLM not available for report generation",
            }

        if not session_entries:
            return {"error": "No session data provided for report"}

        # Format session data into a clear transcript for the LLM
        formatted_transcript = "--- SESSION TRANSCRIPT & FLAGS ---\n"
        for i, entry in enumerate(session_entries):
            speaker = entry.get("speaker", "Speaker")
            text = entry.get("text", "")
            is_biased = entry.get("is_biased", False)
            severity = entry.get("severity", "none")
            
            line = f"[{i+1}] {speaker}: \"{text}\""
            if is_biased:
                line += f" [FLAGGED: {severity} severity]"
            
            formatted_transcript += line + "\n"

        prompt = ScenarioConfig.get_prompt(formatted_transcript, "speech_report")

        payload = {
            "model": self._model_name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2, # Slightly more creative for a comprehensive report
                "num_predict": 1024, # Need more tokens for a full report
            },
        }

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.ollama_host}/api/generate", json=payload
                )

                if response.status_code != 200:
                    logger.warning(f"LLM returned status {response.status_code}")
                    return {"available": True, "error": f"HTTP {response.status_code}"}

                raw_response = response.json().get("response", "")
                parsed = self._defensive_parse(raw_response)

                if parsed:
                    parsed["model_used"] = self._model_name
                    return parsed
                else:
                    return {
                        "available": True,
                        "error": "Failed to parse report response",
                        "raw_response": raw_response[:500],
                    }

        except httpx.ReadTimeout:
            logger.warning("Report generation timed out")
            return {"available": True, "error": "Report generation timed out"}
        except Exception as e:
            logger.error(f"Report error: {e}")
            return {"available": True, "error": str(e)}
