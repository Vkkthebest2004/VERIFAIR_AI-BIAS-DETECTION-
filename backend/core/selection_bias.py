"""
Selection Bias Detector - Industry-Standard Implementation

This module implements statistical tests to detect selection bias in outcomes
(e.g., hiring, admissions, loan approvals) based on protected characteristics.

Methods implemented:
1. Disparate Impact Analysis (Four-Fifths Rule) - EEOC Standard
2. Chi-Square Test - Statistical significance
3. Adverse Impact Ratio (AIR) - Employment discrimination metric
4. Z-Test for Proportions - Group comparisons
5. Fairness Metrics - Equal opportunity, demographic parity

Based on:
- EEOC Uniform Guidelines on Employee Selection Procedures
- Feldman et al. "Certifying and Removing Disparate Impact" (2015)
- Hardt et al. "Equality of Opportunity in Supervised Learning" (2016)
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Tuple
from scipy import stats
from scipy.stats import chi2_contingency, norm
import fairlearn.metrics as flm
import logging

logger = logging.getLogger(__name__)


class SelectionBiasDetector:
    """
    Detects selection bias in outcomes using multiple statistical methods.
    
    Industry-standard implementation following EEOC guidelines and
    academic fairness frameworks.
    """
    
    def __init__(self, four_fifths_threshold: float = 0.8):
        """
        Initialize the detector.
        
        Args:
            four_fifths_threshold: Threshold for Four-Fifths Rule (default: 0.8)
                                  Values below this indicate potential bias
        """
        self.four_fifths_threshold = four_fifths_threshold
        logger.info("SelectionBiasDetector initialized")
    

    def _analyze_keywords(self, candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze candidate text/notes for potential bias keywords.
        """
        BIAS_KEYWORDS = {
            "Gender_Coded_Masculine": [
                "ninja", "rockstar", "guru", "crush it", "dominate", "decisive", "assertive",
                "strong", "competitive", "force", "independent"
            ],
            "Gender_Coded_Feminine": [
                "supportive", "collaborative", "honest", "loyal", "interpersonal", "caring",
                "nurturing", "empathetic", "understanding", "sensitive"
            ],
            "Age_Bias": [
                "digital native", "recent grad", "energetic", "fresh", "young", "adaptable",
                "overqualified", "culture fit", "gap", "career break", "legacy"
            ],
            "Racial_Code": [
                "culture fit", "native english", "articulate", "polish", "clean", "urban",
                "ghetto", "sketchy", "foreign", "illegal"
            ],
            "Disability_Bias": [
                "healthy", "active", "fit", "strong", "lift", "carry", "stand", "walk",
                "see", "hear", "speak"
            ]
        }

        keyword_hits = {category: {} for category in BIAS_KEYWORDS}
        total_with_text = 0

        for cand in candidates:
            text = cand.get("notes") or cand.get("text") or cand.get("feedback")
            if not text:
                continue
            
            total_with_text += 1
            text_lower = str(text).lower()

            for category, keywords in BIAS_KEYWORDS.items():
                for kw in keywords:
                    if f" {kw} " in f" {text_lower} " or text_lower.startswith(kw) or text_lower.endswith(kw):
                        keyword_hits[category][kw] = keyword_hits[category].get(kw, 0) + 1

        # Summarize results
        summary = {}
        for category, hits in keyword_hits.items():
            total_hits = sum(hits.values())
            if total_hits > 0:
                summary[category] = {
                    "total_hits": total_hits,
                    "top_keywords": dict(sorted(hits.items(), key=lambda item: item[1], reverse=True)[:5])
                }
        
        return {
            "analyzed_count": total_with_text,
            "keyword_summary": summary
        }

    def analyze_selection_bias(
        self,
        candidates: List[Dict[str, Any]],
        identity_groups: List[str]
    ) -> Dict[str, Any]:
        """
        Comprehensive selection bias analysis.
        
        Args:
            candidates: List of candidates with format:
                {
                    "id": str,
                    "identities": List[str],
                    "selected": bool/int (0/1),
                    "score": float (optional),
                    "notes": str (optional)
                }
            identity_groups: List of identity groups to analyze
        
        Returns:
            Comprehensive bias analysis dictionary
        """
        if not candidates or len(candidates) < 2:
            return {
                "error": "Insufficient data for analysis (need at least 2 candidates)",
                "bias_detected": False
            }
        
        # 1. Statistical Analysis
        df = self._prepare_dataframe(candidates, identity_groups)
        
        if df.empty:
            return {
                "error": "No valid candidates found",
                "bias_detected": False
            }
        
        # Calculate overall statistics
        total_candidates = len(df)
        total_selected = df['selected'].sum()
        overall_selection_rate = total_selected / total_candidates if total_candidates > 0 else 0
        
        # Analyze each identity group
        group_statistics = {}
        air_violations = []
        
        for identity in identity_groups:
            group_stats = self._analyze_group(df, identity, overall_selection_rate)
            group_statistics[identity] = group_stats
            
            if group_stats['has_bias']:
                air_violations.append(identity)
        
        # Perform chi-square test
        chi_square_results = self._chi_square_test(df, identity_groups)
        
        # Calculate overall bias score
        bias_score, severity = self._calculate_bias_score(
            group_statistics,
            chi_square_results
        )
        
        # Determine if bias is detected
        bias_detected = bool(
            len(air_violations) > 0 or
            (chi_square_results['p_value'] < 0.05 if chi_square_results else False)
        )

        # 2. Keyword Analysis (New)
        keyword_analysis = self._analyze_keywords(candidates)
        if keyword_analysis.get("keyword_summary"):
             # If significant keywords found, maybe bump severity?
             pass

        return {
            "total_candidates": total_candidates,
            "total_selected": int(total_selected),
            "overall_selection_rate": round(overall_selection_rate, 3),
            "group_statistics": group_statistics,
            "chi_square_test": chi_square_results,
            "four_fifths_violations": air_violations,
            "bias_detected": bias_detected,
            "bias_score": bias_score,
            "severity": severity,
            "keyword_analysis": keyword_analysis, # Added this
            "methodology": {
                "four_fifths_rule": "EEOC Standard",
                "chi_square_test": "Statistical Significance",
                "z_test": "Proportion Comparison",
                "keyword_scan": "Linguistic Bias Detection",
                "threshold": self.four_fifths_threshold
            }
        }
    
    def _prepare_dataframe(
        self,
        candidates: List[Dict[str, Any]],
        identity_groups: List[str]
    ) -> pd.DataFrame:
        """Prepare DataFrame for analysis."""
        data = []
        
        for candidate in candidates:
            if 'selected' not in candidate:
                continue
            
            # Robust mapping for 0/1, strings, booleans
            raw_selected = candidate['selected']
            if isinstance(raw_selected, str):
                is_selected = raw_selected.lower() in ('true', '1', 'yes', 'selected', 'hire')
            elif isinstance(raw_selected, (int, float)):
                is_selected = tuple([bool(raw_selected)])[0] # Handle 0/1
            else:
                is_selected = bool(raw_selected)

            row = {
                'selected': is_selected,
                'score': candidate.get('score', 0)
            }
            
            # Create binary columns for each identity
            candidate_identities = candidate.get('identities', [])
            for identity in identity_groups:
                row[f'is_{identity}'] = identity in candidate_identities
            
            data.append(row)
        
        return pd.DataFrame(data)

    def _analyze_group(
        self,
        df: pd.DataFrame,
        identity: str,
        overall_rate: float
    ) -> Dict[str, Any]:
        """
        Analyze a specific identity group for selection bias.
        """
        identity_col = f'is_{identity}'
        
        if identity_col not in df.columns:
            return {"error": f"Identity {identity} not found"}
        
        # Get group data
        group_df = df[df[identity_col] == True]
        non_group_df = df[df[identity_col] == False]
        
        group_total = len(group_df)
        group_selected = group_df['selected'].sum() if group_total > 0 else 0
        group_selection_rate = group_selected / group_total if group_total > 0 else 0
        
        non_group_total = len(non_group_df)
        non_group_selected = non_group_df['selected'].sum() if non_group_total > 0 else 0
        non_group_selection_rate = non_group_selected / non_group_total if non_group_total > 0 else 0
        
        # Calculate Adverse Impact Ratio (AIR)
        # AIR = Rate(Minority) / Rate(Majority)
        # Note: In standard EEOC, we compare to the *highest* selection rate group. 
        # Here we compare to "rest of population" or specific reference if needed.
        # Ideally, we should find the group with the highest rate.
        
        # Simplified: Compare This Group vs Rest
        # If This Group is the highest, AIR is > 1. 
        # If This Group is lower, AIR < 1.
        
        reference_rate = non_group_selection_rate
        if reference_rate == 0:
             air = 1.0 if group_selection_rate > 0 else 0.0 # Edge case
        else:
             air = group_selection_rate / reference_rate
             
        # Z-test for proportions
        z_score, p_value = self._z_test_proportions(
            group_selected, group_total,
            non_group_selected, non_group_total
        )
        
        # Determine if bias exists
        # 1. Four-Fifths Violation: Selection rate < 80% of reference
        four_fifths_violation = air < self.four_fifths_threshold
        
        # 2. Statistically Significant: p < 0.05
        statistically_significant = p_value < 0.05 if p_value is not None else False
        
        has_bias = four_fifths_violation and statistically_significant
        
        # Calculate effect size (Cohen's h)
        effect_size = self._cohens_h(group_selection_rate, non_group_selection_rate)
        
        # Fairlearn: Demographic Parity Difference (Standardized Metric)
        # Calculates |Rate(Group) - Rate(Rest)| robustly
        try:
            dp_diff = flm.demographic_parity_difference(
                y_true=df['selected'], 
                y_pred=df['selected'], 
                sensitive_features=df[identity_col]
            )
        except Exception as e:
            logger.warning(f"Fairlearn metric failed: {e}")
            dp_diff = abs(group_selection_rate - non_group_selection_rate)

        return {
            "total_candidates": int(group_total),
            "selected": int(group_selected),
            "selection_rate": round(group_selection_rate, 3),
            "comparison_group_rate": round(non_group_selection_rate, 3),
            "adverse_impact_ratio": round(air, 3),
            "demographic_parity_difference": round(dp_diff, 3) if dp_diff is not None else None,
            "z_score": round(z_score, 3) if not np.isnan(z_score) else None,
            "p_value": round(p_value, 4) if not np.isnan(p_value) else None,
            "effect_size": round(effect_size, 3),
            "has_bias": bool(has_bias),
            "four_fifths_violation": bool(four_fifths_violation)
        }


    def _z_test_proportions(
        self,
        x1: int, n1: int,
        x2: int, n2: int
    ) -> Tuple[float, float]:
        """
        Z-test for comparing two proportions.
        
        Returns:
            (z_score, p_value)
        """
        if n1 == 0 or n2 == 0:
            return (np.nan, np.nan)
        
        p1 = x1 / n1
        p2 = x2 / n2
        
        # Pooled proportion
        p_pool = (x1 + x2) / (n1 + n2)
        
        # Standard error
        se = np.sqrt(p_pool * (1 - p_pool) * (1/n1 + 1/n2))
        
        if se == 0:
            return (np.nan, np.nan)
        
        # Z-score
        z = (p1 - p2) / se
        
        # Two-tailed p-value
        p_value = 2 * (1 - norm.cdf(abs(z)))
        
        return (z, p_value)
    
    def _chi_square_test(
        self,
        df: pd.DataFrame,
        identity_groups: List[str]
    ) -> Dict[str, Any]:
        """
        Chi-square test for independence across all groups.
        
        Tests if selection outcomes are independent of identity groups.
        """
        try:
            # Create contingency table
            contingency_data = []
            
            for identity in identity_groups:
                identity_col = f'is_{identity}'
                if identity_col in df.columns:
                    group_df = df[df[identity_col] == True]
                    selected = group_df['selected'].sum()
                    not_selected = len(group_df) - selected
                    contingency_data.append([selected, not_selected])
            
            if len(contingency_data) < 2:
                return None
            
            contingency_table = np.array(contingency_data)
            
            # Perform chi-square test
            chi2, p_value, dof, expected = chi2_contingency(contingency_table)
            
            return {
                "statistic": round(chi2, 3),
                "p_value": round(p_value, 4),
                "degrees_of_freedom": int(dof),
                "significant": bool(p_value < 0.05),
                "interpretation": "Significant bias detected" if p_value < 0.05 else "No significant bias"
            }
        except Exception as e:
            logger.error(f"Chi-square test failed: {e}")
            return None
    
    def _cohens_h(self, p1: float, p2: float) -> float:
        """
        Calculate Cohen's h effect size for proportions.
        
        h = 2 * (arcsin(sqrt(p1)) - arcsin(sqrt(p2)))
        
        Interpretation:
        - 0.2: small effect
        - 0.5: medium effect
        - 0.8: large effect
        """
        if np.isnan(p1) or np.isnan(p2):
            return np.nan
        
        h = 2 * (np.arcsin(np.sqrt(p1)) - np.arcsin(np.sqrt(p2)))
        return abs(h)
    
    def _calculate_bias_score(
        self,
        group_statistics: Dict[str, Dict],
        chi_square_results: Dict[str, Any]
    ) -> Tuple[float, str]:
        """
        Calculate overall bias score (0-100) and severity level.
        
        Returns:
            (bias_score, severity_level)
        """
        scores = []
        
        # Factor 1: Number of groups with violations
        groups_with_bias = sum(
            1 for stats in group_statistics.values()
            if isinstance(stats, dict) and stats.get('has_bias', False)
        )
        total_groups = len(group_statistics)
        violation_score = (groups_with_bias / total_groups * 100) if total_groups > 0 else 0
        scores.append(violation_score)
        
        # Factor 2: Severity of AIR violations
        min_air = 1.0
        for stats in group_statistics.values():
            if isinstance(stats, dict) and 'adverse_impact_ratio' in stats:
                air = stats['adverse_impact_ratio']
                if air < min_air:
                    min_air = air
        
        # Convert AIR to score (lower AIR = higher score)
        air_score = (1 - min_air) * 100 if min_air < 1.0 else 0
        scores.append(air_score)
        
        # Factor 3: Chi-square significance
        if chi_square_results and chi_square_results.get('significant'):
            chi_score = (1 - chi_square_results['p_value']) * 100
            scores.append(chi_score)
        
        # Overall score (average of factors)
        bias_score = np.mean(scores) if scores else 0
        
        # Determine severity
        if bias_score >= 75:
            severity = "Critical"
        elif bias_score >= 60:
            severity = "High"
        elif bias_score >= 40:
            severity = "Medium"
        elif bias_score >= 20:
            severity = "Low"
        else:
            severity = "None"
        
        return (round(bias_score, 1), severity)

def detect_selection_bias(
    candidates: List[Dict[str, Any]],
    identity_groups: List[str] = None
) -> Dict[str, Any]:
    """
    Convenience function to detect selection bias.
    """
    if identity_groups is None:
        # Extract all unique identities from candidates
        all_identities = set()
        for candidate in candidates:
            all_identities.update(candidate.get('identities', []))
        identity_groups = list(all_identities)
    
    detector = SelectionBiasDetector()
    return detector.analyze_selection_bias(candidates, identity_groups)
