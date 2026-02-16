
import numpy as np
from typing import List, Dict, Any
from backend.config.bias_config import IDENTITIES

class CollectiveReporter:
    """
    Aggregates bias detection results from multiple inputs to generate
    a comprehensive 'Collective Report' for the Sentinel Engine.
    """

    @staticmethod
    def generate_report(results: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not results:
            return {}

        total_files = len(results)
        total_sentences = sum(r.total_sentences for r in results)
        total_flags = sum(r.bias_flags_count for r in results)

        # --- 1. Bias Landscape (Category Aggregation) ---
        # We need to aggregate Z-scores per identity across all files
        identity_aggregates = {identity: {"sum_z": 0.0, "count": 0, "max_z": 0.0} for identity in IDENTITIES}
        severity_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "None": 0}
        hate_types_count = {}
        total_hate_detected = 0
        all_z_scores = []
        
        # Track most biased file
        most_biased_file = None
        max_flags = -1

        for r in results:
            # Check for most biased file
            if r.bias_flags_count > max_flags:
                max_flags = r.bias_flags_count
                most_biased_file = r.filename

            # Get the full report JSON
            report_data = r.full_report_json
            
            if not report_data or "results" not in report_data:
                continue

            for chunk in report_data["results"]:
                # Process Bias Flags
                for flag in chunk.get("bias_flags", []):
                    identity = flag["identity"]
                    z_score = flag["z_score"]
                    
                    if identity in identity_aggregates:
                        identity_aggregates[identity]["sum_z"] += z_score
                        identity_aggregates[identity]["count"] += 1
                        identity_aggregates[identity]["max_z"] = max(identity_aggregates[identity]["max_z"], z_score)
                    
                    all_z_scores.append(z_score)

                # Process Hate Speech
                hs = chunk.get("hate_speech_analysis", {})
                if hs.get("hate_detected"):
                    total_hate_detected += 1
                    sev = hs.get("severity", "None")
                    severity_counts[sev] = severity_counts.get(sev, 0) + 1
                    
                    for h_type in hs.get("hate_types", []):
                        hate_types_count[h_type] = hate_types_count.get(h_type, 0) + 1

        # Calculate averages for radar chart
        radar_data = []
        for identity in IDENTITIES:
            data = identity_aggregates.get(identity, {"sum_z": 0.0, "count": 0, "max_z": 0.0})
            avg_z = data["sum_z"] / data["count"] if data["count"] > 0 else 0.0
            radar_data.append({
                "subject": identity,
                "A": float(avg_z),  # Average Bias Intensity
                "B": float(data["max_z"]), # Peak Bias Intensity
                "fullMark": 5
            })

        hate_speech_breakdown = [
            {"name": k.replace('_', ' ').title(), "value": v} 
            for k, v in hate_types_count.items()
        ]

        # --- 3. Fairness Score (Inverse of Bias Load) ---
        # Simple heuristic: 100 - (avg_z_score * 10) - (hate_ratio * 50)
        avg_global_z = np.mean(all_z_scores) if all_z_scores else 0.0
        hate_ratio = total_hate_detected / total_sentences if total_sentences > 0 else 0.0
        
        # Bias Load: 0 to 100 (where 0 is perfectly fair)
        # Global Z-Score contributes up to 40 points (avg z=4 -> 40)
        # Hate Speech Ratio contributes up to 60 points (30% hate -> 60)
        bias_load = (avg_global_z * 10) + (hate_ratio * 200)
        fairness_score = max(0, 100 - bias_load)
        
        return {
            "type": "collective_report",
            "is_batch_summary": True,
            "total_files": total_files,
            "total_sentences": total_sentences,
            "total_bias_flags": total_flags,
            "most_biased_file": most_biased_file,
            "fairness_score": float(fairness_score),
            "radar_data": radar_data,
            "hate_speech_breakdown": hate_speech_breakdown,
            "severity_distribution": [
                {"name": k, "value": v} for k, v in severity_counts.items() if v > 0
            ],
            "average_bias_intensity": float(avg_global_z),
            "bias_load": float(bias_load)
        }
