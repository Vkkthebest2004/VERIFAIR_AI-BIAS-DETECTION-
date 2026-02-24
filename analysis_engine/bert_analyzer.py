"""
=============================================================================
  Tier 2: BERT Ensemble Copilot Analyzer
=============================================================================

Fast, BERT-powered deep analysis engine for the Live Copilot.
Wraps the existing VerifairSentinel (which already loads toxic-bert,
facebook/roberta-hate-speech-dynabench-r4-target, and tomh/toxigen_roberta)
to provide:

  - Single-text deep analysis (~50-200ms vs 20-45s with Ollama LLM)
  - Instant session report generation via statistical aggregation
  - Always available (no external Ollama dependency)

Models used (all BERT-family):
  - all-mpnet-base-v2 (sentence-transformers) — embedding-based bias detection
  - unitary/toxic-bert — toxicity classification
  - facebook/roberta-hate-speech-dynabench-r4-target — explicit hate (ACL 2021)
  - tomh/toxigen_roberta — implicit hate (ACL 2022)
"""

import logging
from typing import Dict, Any, List, Optional
from collections import Counter

logger = logging.getLogger("BertCopilotAnalyzer")

# Lazy singleton for the Sentinel instance
_sentinel_instance = None
_sentinel_init_attempted = False


def _get_sentinel():
    """Lazy-load the VerifairSentinel (heavy — loads 4 models)."""
    global _sentinel_instance, _sentinel_init_attempted

    if _sentinel_init_attempted:
        return _sentinel_instance

    _sentinel_init_attempted = True

    try:
        import sys, os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
        from backend.core.sentinel import VerifairSentinel

        logger.info("Loading VerifairSentinel for BERT Copilot Analyzer...")
        _sentinel_instance = VerifairSentinel()
        logger.info("VerifairSentinel loaded successfully for copilot use.")
        return _sentinel_instance
    except Exception as e:
        logger.error(f"Failed to load VerifairSentinel: {e}")
        return None


# ── Severity helpers ──

_SEVERITY_ORDER = {"none": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
_SEVERITY_LABELS = {0: "none", 1: "low", 2: "medium", 3: "high", 4: "critical"}


def _severity_rank(s: str) -> int:
    return _SEVERITY_ORDER.get(s.lower(), 0) if s else 0


# ── Suggestion templates based on detected bias type ──

_SUGGESTIONS = {
    "Ableist Slur": "Replace ableist language with person-first or neutral alternatives.",
    "Homophobic Slur": "Remove homophobic language entirely. Use inclusive, respectful terms.",
    "Racial Slur": "Eliminate racial slurs. Refer to people by their actual roles or attributes.",
    "Caste-Based Slur": "Remove caste-based slurs. Focus on professional qualifications.",
    "Gendered Negative Trait": "Avoid gendered adjectives. Describe behavior objectively.",
    "Toxic Masculinity Pattern": "Avoid reinforcing toxic masculinity stereotypes.",
    "Gendered Role Qualifier": "Drop unnecessary gender qualifiers from professional roles.",
    "Backhanded Compliment": "Rephrase to compliment skills without implying group expectations.",
    "Othering": "Avoid exclusionary framing. Treat all individuals as belonging equally.",
    "Colorblind Racism": "Acknowledge diversity instead of dismissing it.",
    "Othering / Group Dismissal": "Replace group generalizations with specific, respectful references.",
    "Interruption/Silencing Indicator": "Ensure all voices have equal opportunity to contribute.",
    "Housework/Note-Taker Assumption": "Rotate administrative tasks or ask for volunteers.",
    "Tone Policing": "Focus on the substance of arguments, not tone or emotion.",
    "Condescending/Mansplaining Pattern": "Reduce condescending language. Assume competence.",
    "Age Stereotype": "Avoid age-based assumptions. Focus on actual capabilities.",
    "Caste/Reservation Bias": "Avoid undermining credentials based on selection pathway.",
    "Culture Fit Proxy Bias": "Define 'culture fit' by specific behavioral traits, not identity.",
    "Colorism / Skin Tone Bias": "Remove references to skin tone from professional assessments.",
}

_DEFAULT_SUGGESTION = "Consider rephrasing to be more inclusive and unbiased."


class BertCopilotAnalyzer:
    """
    Tier 2: BERT-ensemble deep analysis for the Live Copilot.

    Uses the existing VerifairSentinel to run:
      - Embedding-based bias detection (WEAT/SEAT, Z-scores, effect sizes)
      - Neural toxicity classification (toxic-bert)
      - Hate speech detection (3-layer ensemble)
      - Stereotype detection

    Much faster than LLM-based analysis (~50-200ms per text vs 20-45s).
    """

    MODEL_DESCRIPTION = "toxic-bert + roberta-dynabench + toxigen + mpnet"

    def __init__(self):
        self._sentinel = _get_sentinel()

    @property
    def is_available(self) -> bool:
        return self._sentinel is not None

    @property
    def model_name(self) -> str:
        return self.MODEL_DESCRIPTION

    def analyze(self, text: str, scenario: str = "general") -> Dict[str, Any]:
        """
        Run deep BERT-ensemble analysis on a single text.

        Returns a result shaped for the frontend's Tier 2 display:
          is_biased, severity, bias_type, affected_groups,
          explanation, suggestion, confidence, model_used
        """
        if not self._sentinel:
            return {
                "tier": 2,
                "available": False,
                "error": "BERT Sentinel not loaded",
            }

        try:
            results = self._sentinel.batch_analyze([text])
            if not results:
                return {"tier": 2, "available": True, "error": "No analysis result"}

            r = results[0]

            # ── Extract key signals ──
            is_biased = r.get("is_biased", False)
            hate = r.get("hate_speech_analysis", {})
            stereo = r.get("stereotype_analysis", {})
            bias_flags = r.get("bias_flags", [])
            weat = r.get("weat_analysis", {})

            # ── Determine severity ──
            severity_candidates = []
            if hate.get("hate_detected"):
                severity_candidates.append(hate.get("severity", "none"))
            if stereo.get("has_stereotype"):
                severity_candidates.append(stereo.get("severity_level", "none"))
            for flag in bias_flags:
                severity_candidates.append(flag.get("severity", "none"))

            overall_severity = "none"
            for s in severity_candidates:
                if _severity_rank(s) > _severity_rank(overall_severity):
                    overall_severity = s.lower()

            # ── Determine bias type ──
            bias_types = []
            if hate.get("hate_detected"):
                for ht in hate.get("hate_types", []):
                    bias_types.append(ht.replace("_", " ").title())
            if stereo.get("stereotype_type"):
                bias_types.append(stereo["stereotype_type"])
            for flag in bias_flags:
                identity = flag.get("identity", "")
                if identity:
                    bias_types.append(f"Identity Association ({identity})")

            bias_type = ", ".join(bias_types[:3]) if bias_types else ""

            # ── Affected groups ──
            affected = set()
            for flag in bias_flags:
                if flag.get("identity"):
                    affected.add(flag["identity"])
            for identity in stereo.get("mentioned_identities", []):
                affected.add(identity)
            affected_groups = list(affected)[:5]

            # ── Confidence ──
            confidence_signals = []
            if hate.get("ensemble_score"):
                confidence_signals.append(hate["ensemble_score"])
            if stereo.get("stereotype_score"):
                confidence_signals.append(stereo["stereotype_score"] / 100.0)
            for flag in bias_flags:
                z = abs(flag.get("z_score", 0))
                confidence_signals.append(min(z / 5.0, 1.0))

            confidence = round(max(confidence_signals), 2) if confidence_signals else 0.0

            # ── Build explanation ──
            explanations = []
            if hate.get("hate_detected"):
                score = hate.get("ensemble_score", 0)
                explanations.append(
                    f"Hate speech detected (ensemble score: {score:.2f}, "
                    f"severity: {hate.get('severity', 'unknown')})"
                )
            if stereo.get("has_stereotype"):
                explanations.append(
                    f"Stereotype detected: {stereo.get('stereotype_type', 'unknown')} "
                    f"(score: {stereo.get('stereotype_score', 0):.1f}/100)"
                )
            for flag in bias_flags:
                explanations.append(
                    f"Strong identity association with '{flag.get('identity', '')}' "
                    f"(z-score: {flag.get('z_score', 0):.2f})"
                )
            if weat.get("is_significant") and weat.get("valence") == "Negative":
                explanations.append(
                    f"SEAT analysis shows negative valence "
                    f"(score: {weat.get('seat_score', 0):.4f}, p={weat.get('p_value', 0):.4f})"
                )

            explanation = ". ".join(explanations) if explanations else "No significant bias detected by BERT models."

            # ── Build suggestion ──
            suggestion = _DEFAULT_SUGGESTION
            # Try to match from Tier 1 flag types first
            # (The caller can pass tier1 flags if needed)

            return {
                "tier": 2,
                "available": True,
                "is_biased": is_biased,
                "severity": overall_severity,
                "bias_type": bias_type,
                "affected_groups": affected_groups,
                "explanation": explanation,
                "suggestion": suggestion if is_biased else "",
                "confidence": confidence,
                "model_used": self.MODEL_DESCRIPTION,
                # Extra detail for frontend hover/expand
                "hate_speech": {
                    "detected": hate.get("hate_detected", False),
                    "ensemble_score": hate.get("ensemble_score", 0),
                    "severity": hate.get("severity", "None"),
                },
                "stereotype": {
                    "detected": stereo.get("has_stereotype", False),
                    "score": stereo.get("stereotype_score", 0),
                    "type": stereo.get("stereotype_type"),
                },
                "weat": {
                    "seat_score": weat.get("seat_score", 0),
                    "valence": weat.get("valence", "Neutral"),
                },
            }

        except Exception as e:
            logger.error(f"BERT analysis error: {e}")
            return {"tier": 2, "available": True, "error": str(e)}

    def generate_session_report(
        self, session_entries: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Generate an instant session report via statistical aggregation.

        No LLM needed — computes:
          - Overall inclusivity score (0-10)
          - Summary paragraph
          - Primary bias patterns
          - Speaker dynamics
          - Coaching suggestions

        Runs in < 10ms (pure Python aggregation).
        """
        if not session_entries:
            return {"error": "No session data provided"}

        total = len(session_entries)
        flagged = []
        for e in session_entries:
            # Check both root and tier2 for bias
            is_biased = e.get("is_biased", False)
            t2 = e.get("tier2") or {}
            if is_biased or t2.get("is_biased", False):
                flagged.append(e)
                
        flagged_count = len(flagged)
        clean_count = total - flagged_count

        # ── Overall score (0-10, higher = more inclusive) ──
        if total == 0:
            overall_score = 10.0
        else:
            bias_rate = flagged_count / total
            # Deduct more heavily for critical/high severity
            severity_penalty = 0
            for e in flagged:
                t2 = e.get("tier2") or {}
                # Take highest severity between root and tier2
                sev = t2.get("severity") or e.get("severity", "low")
                sev = str(sev).lower()
                if sev == "critical":
                    severity_penalty += 2.0
                elif sev == "high":
                    severity_penalty += 1.5
                elif sev == "medium":
                    severity_penalty += 1.0
                else:
                    severity_penalty += 0.5

            raw_score = 10.0 - (bias_rate * 5.0) - min(severity_penalty * 0.5, 4.0)
            overall_score = round(max(0, min(10, raw_score)), 1)

        # ── Primary bias patterns ──
        pattern_counter: Counter = Counter()
        severity_counter: Counter = Counter()

        for entry in flagged:
            entry_severity = "low"
            # 1. Tier 1 patterns
            tier1 = entry.get("tier1") or {}
            flags = tier1.get("flags", []) if isinstance(tier1, dict) else []
            for flag in flags:
                if isinstance(flag, dict):
                    pattern_counter[flag.get("type", "Unknown Pattern")] += 1
                    s = flag.get("severity", "unknown")
                    if _severity_rank(s) > _severity_rank(entry_severity):
                        entry_severity = s
            
            # 2. Tier 2 patterns
            tier2 = entry.get("tier2") or {}
            if isinstance(tier2, dict) and tier2.get("is_biased"):
                bias_type = tier2.get("bias_type", "")
                if bias_type:
                    for bt in bias_type.split(","):
                        bt = bt.strip()
                        if bt and bt != "Unknown":
                            pattern_counter[bt] += 1
                
                s = tier2.get("severity", "unknown")
                if _severity_rank(s) > _severity_rank(entry_severity):
                    entry_severity = s
            
            severity_counter[entry_severity.lower()] += 1

        primary_patterns = []
        for pattern, count in pattern_counter.most_common(5):
            primary_patterns.append(f"{pattern} (detected {count} time{'s' if count > 1 else ''})")

        if not primary_patterns and flagged_count > 0:
            primary_patterns = [f"{flagged_count} utterance{'s' if flagged_count > 1 else ''} flagged for potential bias"]

        # ── Speaker dynamics ──
        speaker_stats: Dict[str, Dict[str, int]] = {}
        for entry in session_entries:
            speaker = entry.get("speaker", "Speaker 1")
            if speaker not in speaker_stats:
                speaker_stats[speaker] = {"total": 0, "flagged": 0, "words": 0}
            speaker_stats[speaker]["total"] += 1
            if entry.get("is_biased") or (entry.get("tier2") or {}).get("is_biased"):
                speaker_stats[speaker]["flagged"] += 1
            speaker_stats[speaker]["words"] += len(entry.get("text", "").split())

        dynamics_parts = []
        for speaker, stats in speaker_stats.items():
            flag_rate = (stats["flagged"] / stats["total"] * 100) if stats["total"] > 0 else 0
            dynamics_parts.append(
                f"{speaker}: {stats['total']} utterances, "
                f"{stats['flagged']} flagged ({flag_rate:.0f}% bias rate), "
                f"{stats['words']} words"
            )

        speaker_dynamics = ". ".join(dynamics_parts) if dynamics_parts else "Single speaker session."

        # ── Summary ──
        if flagged_count == 0:
            summary = (
                f"Excellent session. All {total} utterances were analyzed and "
                f"none were flagged for bias. The speaker maintained inclusive, "
                f"neutral language throughout."
            )
        elif overall_score >= 7:
            summary = (
                f"Good session overall. Out of {total} analyzed utterances, "
                f"{flagged_count} ({flagged_count/total*100:.0f}%) were flagged. "
                f"The detected issues were mostly minor and can be addressed "
                f"with simple language adjustments."
            )
        elif overall_score >= 4:
            top_pattern = primary_patterns[0] if primary_patterns else "various bias types"
            summary = (
                f"This session showed moderate bias concerns. "
                f"{flagged_count} of {total} utterances ({flagged_count/total*100:.0f}%) "
                f"were flagged, with the most common issue being {top_pattern}. "
                f"Focused coaching in these areas is recommended."
            )
        else:
            summary = (
                f"Significant bias concerns detected. {flagged_count} of {total} "
                f"utterances ({flagged_count/total*100:.0f}%) were flagged, "
                f"including {severity_counter.get('critical', 0) + severity_counter.get('high', 0)} "
                f"high-severity instances. Immediate attention to inclusive language is strongly recommended."
            )

        # ── Coaching suggestions ──
        suggestions = []
        seen_types = set()
        for pattern, _ in pattern_counter.most_common(5):
            suggestion = _SUGGESTIONS.get(pattern, _DEFAULT_SUGGESTION)
            if suggestion not in seen_types:
                suggestions.append(suggestion)
                seen_types.add(suggestion)

        # Always add generic advice if few suggestions
        if len(suggestions) < 2:
            generic = [
                "Pause before speaking to consider the impact of word choices on all listeners.",
                "Use person-first language and focus on actions rather than identity traits.",
                "When giving feedback, focus on specific behaviors rather than character traits.",
            ]
            for g in generic:
                if len(suggestions) >= 4:
                    break
                if g not in seen_types:
                    suggestions.append(g)

        return {
            "overall_score": overall_score,
            "summary": summary,
            "primary_bias_patterns": primary_patterns,
            "speaker_dynamics": speaker_dynamics,
            "key_suggestions": suggestions[:5],
            "model_used": self.MODEL_DESCRIPTION,
            "basic_stats": {
                "total_entries": total,
                "total_flags": flagged_count,
                "clean_entries": clean_count,
                "severity_breakdown": dict(severity_counter),
            },
        }
