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
                    "selected": bool,
                    "score": float (optional)
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
        
        # Convert to DataFrame for easier analysis
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
        bias_detected = (
            len(air_violations) > 0 or
            (chi_square_results['p_value'] < 0.05 if chi_square_results else False)
        )
        
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
            "methodology": {
                "four_fifths_rule": "EEOC Standard",
                "chi_square_test": "Statistical Significance",
                "z_test": "Proportion Comparison",
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
            
            row = {
                'selected': bool(candidate['selected']),
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
        
        Uses:
        1. Adverse Impact Ratio (AIR)
        2. Z-test for proportions
        3. Four-Fifths Rule
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
        reference_rate = max(group_selection_rate, non_group_selection_rate)
        air = group_selection_rate / reference_rate if reference_rate > 0 else 1.0
        
        # Z-test for proportions
        z_score, p_value = self._z_test_proportions(
            group_selected, group_total,
            non_group_selected, non_group_total
        )
        
        # Determine if bias exists
        has_bias = air < self.four_fifths_threshold and p_value < 0.05
        
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
            "demographic_parity_difference": round(dp_diff, 3) if dp_diff is not None else None, # New
            "z_score": round(z_score, 3) if not np.isnan(z_score) else None,
            "p_value": round(p_value, 4) if not np.isnan(p_value) else None,
            "effect_size": round(effect_size, 3),
            "has_bias": has_bias,
            "four_fifths_violation": air < self.four_fifths_threshold
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
                "significant": p_value < 0.05,
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


# Convenience function
def detect_selection_bias(
    candidates: List[Dict[str, Any]],
    identity_groups: List[str] = None
) -> Dict[str, Any]:
    """
    Convenience function to detect selection bias.
    
    Args:
        candidates: List of candidate dictionaries with 'identities' and 'selected' keys
        identity_groups: List of identity groups to analyze (optional)
    
    Returns:
        Bias analysis results
    """
    if identity_groups is None:
        # Extract all unique identities from candidates
        all_identities = set()
        for candidate in candidates:
            all_identities.update(candidate.get('identities', []))
        identity_groups = list(all_identities)
    
    detector = SelectionBiasDetector()
    return detector.analyze_selection_bias(candidates, identity_groups)
