"""
=============================================================================
  VERIFAIR Analysis Engine — Standalone, Installable Bias Detection Package
=============================================================================

A decoupled, pip-installable package that provides:
  1. Tier 1: Fast heuristic/keyword/regex-based bias scanning
  2. Tier 2: Deep LLM-powered contextual analysis via Ollama
  3. Speaker role identification
  4. Scenario-aware configuration (general, meeting, interview, etc.)

Install:
    pip install -e .

Usage:
    from analysis_engine import HeuristicAnalyzer, LLMAnalyzer, SpeakerRoleDetector
"""

from analysis_engine.heuristic import HeuristicAnalyzer
from analysis_engine.llm_analyzer import LLMAnalyzer
from analysis_engine.speaker_roles import SpeakerRoleDetector
from analysis_engine.scenario_config import ScenarioConfig

__version__ = "1.0.0"
__all__ = ["HeuristicAnalyzer", "LLMAnalyzer", "SpeakerRoleDetector", "ScenarioConfig"]
