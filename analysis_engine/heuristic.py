"""
=============================================================================
  Tier 1: Heuristic / Keyword Bias Analyzer
=============================================================================

Fast, regex-based heuristic engine that runs in milliseconds.
Suitable for rapid tonal checks and overt, explicit bias detection.

This is the first-pass filter before the heavier LLM analysis.
It catches:
  - Explicit slurs and hate speech keywords
  - Gendered language patterns  
  - Stereotyping phrases
  - Microaggression patterns
  - Meeting-specific dynamics (interruptions, idea theft phrasing)
"""

import re
from typing import Dict, List, Any


class HeuristicAnalyzer:
    """
    Tier 1: Millisecond-speed regex and keyword bias detection.
    Returns structured results indicating type, severity, and matched patterns.
    """

    # ── Explicit Slurs & Hate Speech (highest severity) ──
    HATE_PATTERNS: List[Dict[str, Any]] = [
        {
            "pattern": re.compile(
                r"\b(retard|retarded|cripple|crippled|spastic)\b", re.IGNORECASE
            ),
            "type": "Ableist Slur",
            "severity": "critical",
            "group": "Disabled",
        },
        {
            "pattern": re.compile(
                r"\b(faggot|fag|dyke|tranny|homo|queer)\b", re.IGNORECASE
            ),
            "type": "Homophobic Slur",
            "severity": "critical",
            "group": "LGBTQ",
        },
        {
            "pattern": re.compile(
                r"\b(nigger|nigga|kike|spic|wetback|gook|chink|jap|paki|sand\s?nigger|towelhead|raghead)\b",
                re.IGNORECASE,
            ),
            "type": "Racial Slur",
            "severity": "critical",
            "group": "Racial/Ethnic",
        },
        {
            "pattern": re.compile(
                r"\b(chamar|bhangi|chuhra|dom|achhoot|untouchable|low[\s-]?caste|low[\s-]?born)\b",
                re.IGNORECASE,
            ),
            "type": "Caste-Based Slur",
            "severity": "critical",
            "group": "Dalit/Bahujan",
        },
    ]

    # ── Gendered Language Patterns ──
    GENDERED_PATTERNS: List[Dict[str, Any]] = [
        {
            "pattern": re.compile(
                r"\b(bossy|shrill|hysterical|emotional|catty|ditzy|naggy|bitchy)\b",
                re.IGNORECASE,
            ),
            "type": "Gendered Negative Trait",
            "severity": "medium",
            "group": "Female",
            "note": "These adjectives are disproportionately applied to women",
        },
        {
            "pattern": re.compile(
                r"\b(man\s*up|grow\s+a\s+pair|boys\s+will\s+be\s+boys|be\s+a\s+man)\b",
                re.IGNORECASE,
            ),
            "type": "Toxic Masculinity Pattern",
            "severity": "medium",
            "group": "Male/Gender",
        },
        {
            "pattern": re.compile(
                r"\b(lady\s+doctor|lady\s+engineer|female\s+boss|girl\s+boss|woman\s+driver)\b",
                re.IGNORECASE,
            ),
            "type": "Gendered Role Qualifier",
            "severity": "low",
            "group": "Female",
            "note": "Unnecessarily gendering a role implies it's unusual for that gender",
        },
    ]

    # ── Microaggression Patterns ──
    MICROAGGRESSION_PATTERNS: List[Dict[str, Any]] = [
        {
            "pattern": re.compile(
                r"\b(you'?re?\s+so\s+articulate|speak\s+(?:so\s+)?well\s+for)\b",
                re.IGNORECASE,
            ),
            "type": "Backhanded Compliment",
            "severity": "medium",
            "group": "Racial/Ethnic",
            "note": "Implies surprise that someone from their group is articulate",
        },
        {
            "pattern": re.compile(
                r"\b(where\s+are\s+you\s+really\s+from|what\s+are\s+you|you\s+don'?t\s+look\s+like)\b",
                re.IGNORECASE,
            ),
            "type": "Othering",
            "severity": "medium",
            "group": "Racial/Ethnic",
        },
        {
            "pattern": re.compile(
                r"\b(I\s+don'?t\s+see\s+colou?r|all\s+lives\s+matter|reverse\s+racism)\b",
                re.IGNORECASE,
            ),
            "type": "Colorblind Racism",
            "severity": "medium",
            "group": "Racial/Ethnic",
        },
        {
            "pattern": re.compile(
                r"\b(you\s+people|those\s+people|them\s+kind|their\s+kind)\b",
                re.IGNORECASE,
            ),
            "type": "Othering / Group Dismissal",
            "severity": "medium",
            "group": "General",
        },
    ]

    # ── Meeting-Specific Dynamics ──
    MEETING_PATTERNS: List[Dict[str, Any]] = [
        {
            "pattern": re.compile(
                r"\b(like\s+I\s+(?:just\s+)?said|as\s+I\s+was\s+saying|if\s+I\s+could\s+finish|let\s+me\s+finish|you\s+interrupted)\b",
                re.IGNORECASE,
            ),
            "type": "Interruption/Silencing Indicator",
            "severity": "low",
            "group": "Meeting Dynamic",
        },
        {
            "pattern": re.compile(
                r"\b(can\s+you\s+take\s+notes|grab\s+(?:the\s+)?coffee|order\s+(?:the\s+)?food|book\s+(?:the\s+)?room)\b",
                re.IGNORECASE,
            ),
            "type": "Housework/Note-Taker Assumption",
            "severity": "medium",
            "group": "Meeting Dynamic",
            "note": "Assigning administrative tasks can reflect gendered expectations",
        },
        {
            "pattern": re.compile(
                r"\b(don'?t\s+get\s+(?:so\s+)?emotional|calm\s+down|relax|you'?re?\s+overreacting|being\s+too\s+sensitive)\b",
                re.IGNORECASE,
            ),
            "type": "Tone Policing",
            "severity": "medium",
            "group": "General",
        },
        {
            "pattern": re.compile(
                r"\b(well\s+actually|let\s+me\s+explain\s+(?:it\s+)?(?:to\s+you|simply)|it'?s?\s+not\s+(?:that\s+)?hard|even\s+a\s+child)\b",
                re.IGNORECASE,
            ),
            "type": "Condescending/Mansplaining Pattern",
            "severity": "medium",
            "group": "General",
        },
    ]

    # ── Stereotype Phrases ──
    STEREOTYPE_PATTERNS: List[Dict[str, Any]] = [
        {
            "pattern": re.compile(
                r"\b(too\s+old\s+(?:to|for)|past\s+(?:their|his|her)\s+prime|should\s+retire|technologically\s+challenged)\b",
                re.IGNORECASE,
            ),
            "type": "Age Stereotype",
            "severity": "medium",
            "group": "Elderly",
        },
        {
            "pattern": re.compile(
                r"\b(reservation\s+candidate|quota\s+hire|lacks?\s+merit|not\s+merit[-\s]?based)\b",
                re.IGNORECASE,
            ),
            "type": "Caste/Reservation Bias",
            "severity": "high",
            "group": "Dalit/Bahujan",
        },
        {
            "pattern": re.compile(
                r"\b(culture\s+fit|not\s+(?:a\s+)?(?:good\s+)?fit|wouldn'?t?\s+fit\s+in)\b",
                re.IGNORECASE,
            ),
            "type": "Culture Fit Proxy Bias",
            "severity": "low",
            "group": "General",
            "note": "'Culture fit' is often used as coded language for identity-based exclusion",
        },
        {
            "pattern": re.compile(
                r"\b(fair\s+skin|wheatish|dusky|dark\s+(?:skinned|complexion)|pleasing\s+personality|clean\s+look)\b",
                re.IGNORECASE,
            ),
            "type": "Colorism / Skin Tone Bias",
            "severity": "high",
            "group": "General/India",
        },
    ]

    @classmethod
    def analyze(cls, text: str, scenario: str = "general") -> Dict[str, Any]:
        """
        Run Tier 1 heuristic analysis on the input text.
        
        Returns a structured result with all detected bias patterns,
        overall severity, and a count of flags.
        
        This runs in < 5ms even for long texts.
        """
        if not text or not text.strip():
            return {
                "tier": 1,
                "is_biased": False,
                "severity": "none",
                "flags": [],
                "flag_count": 0,
            }

        flags: List[Dict[str, Any]] = []

        # Combine all pattern categories
        all_patterns = (
            cls.HATE_PATTERNS
            + cls.GENDERED_PATTERNS
            + cls.MICROAGGRESSION_PATTERNS
            + cls.STEREOTYPE_PATTERNS
        )

        # Include meeting patterns if scenario is meeting
        if scenario.lower() in ("meeting", "interview", "hr_review"):
            all_patterns = all_patterns + cls.MEETING_PATTERNS

        # Run all patterns
        for rule in all_patterns:
            matches = rule["pattern"].findall(text)
            if matches:
                flags.append({
                    "type": rule["type"],
                    "severity": rule["severity"],
                    "group": rule["group"],
                    "matched_text": list(set(matches))[:5],  # cap at 5 unique
                    "note": rule.get("note", ""),
                })

        # Determine overall severity
        severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1, "none": 0}
        max_severity = "none"
        for f in flags:
            if severity_order.get(f["severity"], 0) > severity_order.get(max_severity, 0):
                max_severity = f["severity"]

        return {
            "tier": 1,
            "is_biased": len(flags) > 0,
            "severity": max_severity,
            "flags": flags,
            "flag_count": len(flags),
        }
