"""
=============================================================================
  Scenario-Aware Configuration — "Scenario-Aware Prompt Engineering"
=============================================================================

Instead of a static one-size-fits-all prompt, this module provides 
dictionaries of prompt templates tuned for specific environments:
  - "general"   → Default conversational analysis
  - "meeting"   → Corporate meeting dynamics (idea appropriation, silencing)
  - "interview" → Hiring/interview bias patterns
  - "hr_review" → Performance review language bias

When analyzing a corporate meeting, the LLM is primed with the right persona
and instructed to look for environment-specific dynamics.
"""

from typing import Dict, Any


class ScenarioConfig:
    """
    Holds multiple prompt template dictionaries for scenario-aware analysis.
    The engine selects the right config based on the user's selected scenario.
    """

    SCENARIOS: Dict[str, Dict[str, Any]] = {
        "general": {
            "persona": "Expert Linguistic Bias Analyst",
            "instruction": (
                "Analyze the following text for any form of bias, stereotyping, "
                "microaggressions, exclusionary language, or discriminatory undertones. "
                "Consider gender, race, age, religion, disability, caste, and socioeconomic bias."
            ),
            "focus_areas": [
                "Stereotyping",
                "Exclusionary language",
                "Microaggressions",
                "Discriminatory undertones",
                "Dehumanizing comparisons",
            ],
            "json_skeleton": {
                "is_biased": False,
                "severity": "none",
                "bias_type": "",
                "affected_groups": [],
                "explanation": "",
                "suggestion": "",
                "confidence": 0.0,
            },
        },
        "meeting": {
            "persona": "Expert Workplace Behavior Analyst specializing in meeting dynamics",
            "instruction": (
                "Analyze the following meeting transcript segment for workplace bias dynamics. "
                "Look specifically for: Idea Appropriation (someone restating another's idea as their own), "
                "Interruption patterns, Credit stealing, Silencing or dismissing contributions, "
                "Note-taker/housework assumptions (assuming certain people should take notes or order food), "
                "Tone policing, Mansplaining or condescending explanations, "
                "and Differential treatment based on identity."
            ),
            "focus_areas": [
                "Idea Appropriation",
                "Interruption & Silencing",
                "Credit Stealing",
                "Note-taker Assumptions",
                "Tone Policing",
                "Condescending Explanations",
                "Differential Treatment",
                "Gatekeeping",
            ],
            "json_skeleton": {
                "is_biased": False,
                "severity": "none",
                "bias_type": "",
                "dynamic_type": "",
                "affected_groups": [],
                "perpetrator_role": "",
                "explanation": "",
                "suggestion": "",
                "confidence": 0.0,
            },
        },
        "interview": {
            "persona": "Expert Hiring Bias Analyst with deep knowledge of employment discrimination law",
            "instruction": (
                "Analyze the following interview transcript for hiring bias. "
                "Look for: Illegal or inappropriate questions (family status, religion, age), "
                "Differential questioning depth, Culture fit bias used as proxy for identity bias, "
                "Affinity bias (favoring similar backgrounds), Halo/horn effects, "
                "Name-based bias, Credential gatekeeping (e.g. preferring elite colleges), "
                "and Language or accent discrimination."
            ),
            "focus_areas": [
                "Illegal Questions",
                "Differential Questioning",
                "Culture Fit Proxy Bias",
                "Affinity Bias",
                "Halo/Horn Effect",
                "Name-Based Bias",
                "Credential Gatekeeping",
                "Accent Discrimination",
            ],
            "json_skeleton": {
                "is_biased": False,
                "severity": "none",
                "bias_type": "",
                "affected_groups": [],
                "legal_risk": "none",
                "explanation": "",
                "suggestion": "",
                "confidence": 0.0,
            },
        },
        "hr_review": {
            "persona": "Expert Performance Review Analyst specializing in equity in evaluations",
            "instruction": (
                "Analyze the following performance review text for evaluation bias. "
                "Look for: Gendered language (e.g. 'abrasive' for women, 'assertive' for men), "
                "Vague subjective feedback ('not a culture fit', 'lacks presence'), "
                "Length disparity (shorter reviews for minorities), "
                "Developmental vs. achievement framing, "
                "Personality-over-performance bias, and Shifting standards."
            ),
            "focus_areas": [
                "Gendered Language",
                "Vague Subjective Feedback",
                "Personality-Over-Performance",
                "Developmental vs Achievement Framing",
                "Shifting Standards",
                "Double Standards",
            ],
            "json_skeleton": {
                "is_biased": False,
                "severity": "none",
                "bias_type": "",
                "affected_groups": [],
                "explanation": "",
                "suggestion": "",
                "confidence": 0.0,
            },
        },
        "speech_report": {
            "persona": "Expert Speech & Communication Coach specializing in Inclusive Language",
            "instruction": (
                "You are generating a comprehensive End-of-Session Speech Bias Report. "
                "Analyze the provided transcript and the flagged bias events from the session. "
                "Identify overarching patterns of bias, exclusionary language, or hostile speaker dynamics. "
                "Evaluate the speaker's overall inclusivity and provide a constructive, actionable summary "
                "to help them improve their communication style."
            ),
            "focus_areas": [
                "Overall Inclusivity Score",
                "Recurring Bias Patterns",
                "Speaker Dynamics (Dominance, Interruptions)",
                "Actionable Improvement Strategies",
            ],
            "json_skeleton": {
                "overall_score": 0,
                "summary": "",
                "primary_bias_patterns": [],
                "speaker_dynamics": "",
                "key_suggestions": [],
            },
        },
    }

    @classmethod
    def get_scenario(cls, scenario_name: str) -> Dict[str, Any]:
        """Get scenario config, falling back to 'general' if unknown."""
        return cls.SCENARIOS.get(scenario_name.lower(), cls.SCENARIOS["general"])

    @classmethod
    def get_prompt(cls, text: str, scenario_name: str = "general") -> str:
        """
        Build a full LLM prompt with persona, instruction, JSON skeleton
        constraint, and the input text — scenario-aware.
        """
        scenario = cls.get_scenario(scenario_name)
        
        focus_list = "\n".join(f"  - {f}" for f in scenario["focus_areas"])
        
        import json
        skeleton = json.dumps(scenario["json_skeleton"], indent=2)
        
        prompt = f"""You are a {scenario["persona"]}.

{scenario["instruction"]}

Focus areas to check:
{focus_list}

TEXT TO ANALYZE:
\"{text}\"

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON matching this exact schema — NO markdown, NO commentary:
{skeleton}

2. Set "severity" to one of: "none", "low", "medium", "high", "critical"
3. Set "confidence" between 0.0 and 1.0
4. If no bias detected, set is_biased=false and severity="none"
5. Be specific in "explanation" — quote the exact words that are problematic
6. In "suggestion", provide an alternative, less biased phrasing

Return ONLY the JSON object:"""
        
        return prompt

    @classmethod
    def list_scenarios(cls) -> list:
        """Return available scenario names."""
        return list(cls.SCENARIOS.keys())
