"""
=============================================================================
  Speaker Role Detector — Identifying Roles from Conversation Context
=============================================================================

Uses heuristic patterns and (optionally) LLM analysis to identify speaker
roles in conversations:
  - Manager / Supervisor
  - Interviewer / Interviewee
  - Facilitator / Participant
  - Dominant / Submissive speaker
  - Neutral

This enables the system to provide richer context about WHO is exhibiting
bias and TOWARD WHOM, which is critical for workplace dynamics analysis.
"""

import re
from typing import Dict, Any, List, Optional


class SpeakerRoleDetector:
    """
    Identifies speaker roles from conversation text patterns.
    Uses keyword and structural analysis of speech patterns.
    """

    # Patterns that indicate managerial/authority language
    AUTHORITY_PATTERNS = [
        re.compile(r"\b(I (?:need|want|expect|require) (?:you|everyone|the team) to)\b", re.IGNORECASE),
        re.compile(r"\b((?:your|the) (?:deadline|target|assignment|task|deliverable))\b", re.IGNORECASE),
        re.compile(r"\b(I'?(?:m|ve) (?:decided|assigned|approved|rejected|reviewed))\b", re.IGNORECASE),
        re.compile(r"\b((?:you|they) (?:should|must|need to|have to|are required))\b", re.IGNORECASE),
        re.compile(r"\b(report (?:to me|by|before)|performance (?:review|evaluation))\b", re.IGNORECASE),
    ]

    # Patterns that indicate interviewer language
    INTERVIEWER_PATTERNS = [
        re.compile(r"\b(tell me about (?:yourself|your|a time))\b", re.IGNORECASE),
        re.compile(r"\b((?:what|why|how) (?:would you|do you|did you|can you))\b", re.IGNORECASE),
        re.compile(r"\b(walk me through|describe (?:a|your)|give me an example)\b", re.IGNORECASE),
        re.compile(r"\b(where do you see yourself|what (?:are|is) your (?:strength|weakness))\b", re.IGNORECASE),
        re.compile(r"\b(do you have (?:any )?questions (?:for (?:us|me)))\b", re.IGNORECASE),
    ]

    # Patterns indicating dominant speaking behavior
    DOMINANT_PATTERNS = [
        re.compile(r"\b((?:no|actually|well),?\s+(?:what I|I think|let me))\b", re.IGNORECASE),
        re.compile(r"\b((?:I|we) (?:already|obviously|clearly) (?:know|said|covered))\b", re.IGNORECASE),
        re.compile(r"\b(that'?s (?:not|wrong|incorrect)|you'?re (?:wrong|mistaken))\b", re.IGNORECASE),
        re.compile(r"\b(listen|look|let me (?:be clear|stop you))\b", re.IGNORECASE),
    ]

    # Patterns indicating facilitation
    FACILITATOR_PATTERNS = [
        re.compile(r"\b((?:what|does) (?:anyone|everyone|somebody) (?:have|think|want))\b", re.IGNORECASE),
        re.compile(r"\b(let'?s (?:hear from|go around|move (?:on|to)|take a))\b", re.IGNORECASE),
        re.compile(r"\b((?:any|other) (?:thoughts|opinions|input|feedback|questions))\b", re.IGNORECASE),
        re.compile(r"\b(I'?d like to (?:hear|get) (?:everyone'?s?|your) (?:input|thoughts|take))\b", re.IGNORECASE),
    ]

    @classmethod
    def detect_role(cls, text: str) -> Dict[str, Any]:
        """
        Analyze a text segment and infer the speaker's likely role.
        Returns role classification with confidence scores.
        """
        if not text or not text.strip():
            return {
                "role": "unknown",
                "confidence": 0.0,
                "indicators": [],
            }

        scores = {
            "authority": 0,
            "interviewer": 0,
            "dominant": 0,
            "facilitator": 0,
        }
        indicators: List[str] = []

        for p in cls.AUTHORITY_PATTERNS:
            matches = p.findall(text)
            if matches:
                scores["authority"] += len(matches)
                indicators.append(f"Authority: '{matches[0]}'")

        for p in cls.INTERVIEWER_PATTERNS:
            matches = p.findall(text)
            if matches:
                scores["interviewer"] += len(matches)
                indicators.append(f"Interviewer: '{matches[0]}'")

        for p in cls.DOMINANT_PATTERNS:
            matches = p.findall(text)
            if matches:
                scores["dominant"] += len(matches)
                indicators.append(f"Dominant: '{matches[0]}'")

        for p in cls.FACILITATOR_PATTERNS:
            matches = p.findall(text)
            if matches:
                scores["facilitator"] += len(matches)
                indicators.append(f"Facilitator: '{matches[0]}'")

        # Determine primary role
        max_score = max(scores.values())
        if max_score == 0:
            return {
                "role": "participant",
                "confidence": 0.5,
                "indicators": [],
                "scores": scores,
            }

        primary_role = max(scores, key=scores.get)
        total = sum(scores.values())
        confidence = round(max_score / total, 2) if total > 0 else 0.0

        role_map = {
            "authority": "manager/supervisor",
            "interviewer": "interviewer",
            "dominant": "dominant speaker",
            "facilitator": "facilitator",
        }

        return {
            "role": role_map.get(primary_role, "participant"),
            "confidence": confidence,
            "indicators": indicators[:5],  # top 5
            "scores": scores,
        }

    @classmethod
    def analyze_conversation_dynamics(
        cls, segments: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Analyze a list of speaker segments to identify conversation dynamics.
        
        Each segment should have:
          - "speaker": speaker label/name
          - "text": what they said
          
        Returns dynamics analysis: who dominates, role assignments, imbalances.
        """
        speaker_stats: Dict[str, Dict[str, Any]] = {}

        for seg in segments:
            speaker = seg.get("speaker", "Unknown")
            text = seg.get("text", "")

            if speaker not in speaker_stats:
                speaker_stats[speaker] = {
                    "word_count": 0,
                    "segment_count": 0,
                    "roles_detected": [],
                }

            speaker_stats[speaker]["word_count"] += len(text.split())
            speaker_stats[speaker]["segment_count"] += 1

            role = cls.detect_role(text)
            if role["role"] != "participant":
                speaker_stats[speaker]["roles_detected"].append(role["role"])

        # Calculate dominance
        total_words = sum(s["word_count"] for s in speaker_stats.values())
        for speaker, stats in speaker_stats.items():
            stats["word_share"] = (
                round(stats["word_count"] / total_words * 100, 1)
                if total_words > 0
                else 0
            )
            # Most frequent role
            if stats["roles_detected"]:
                from collections import Counter
                role_counts = Counter(stats["roles_detected"])
                stats["primary_role"] = role_counts.most_common(1)[0][0]
            else:
                stats["primary_role"] = "participant"

        return {
            "speakers": speaker_stats,
            "total_words": total_words,
            "total_segments": len(segments),
            "balance_score": cls._calculate_balance(speaker_stats),
        }

    @staticmethod
    def _calculate_balance(speaker_stats: Dict) -> float:
        """
        Calculate conversation balance as a 0-100 score.
        100 = perfectly balanced, 0 = one person dominates entirely.
        """
        if len(speaker_stats) <= 1:
            return 100.0
        
        shares = [s["word_share"] for s in speaker_stats.values()]
        ideal_share = 100.0 / len(shares)
        deviations = [abs(share - ideal_share) for share in shares]
        avg_deviation = sum(deviations) / len(deviations)
        
        # Convert to 0-100 score (lower deviation = higher balance)
        balance = max(0.0, 100.0 - avg_deviation * 2)
        return round(balance, 1)
