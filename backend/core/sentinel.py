
import numpy as np
from sentence_transformers import SentenceTransformer, util
from typing import List, Dict, Any, Union
import logging
from transformers import pipeline

# Import configuration from config file
try:
    from backend.config.bias_config import (
        IDENTITIES, 
        TARGET_CONCEPTS, 
        QUALITY_CONCEPTS,
        ADVICE_DISPARITY_CONCEPTS,
        STEREOTYPE_CONCEPTS,
        STEREOTYPE_SEVERITY,
        SENSITIVITY_THRESHOLD, 
        MODEL_NAME
    )
except ImportError:
    # Fallback if run directly or config not found (mainly for testing)
    IDENTITIES = ["Male", "Female", "Non-binary", "Asian", "Black", "White"]
    TARGET_CONCEPTS = {"Risk": ["High-Risk", "Aggressive"], "Employment": ["Hired"]}
    QUALITY_CONCEPTS = {"Vague": ["maybe", "possibly", "might", "could be"]}
    ADVICE_DISPARITY_CONCEPTS = {"Positive_Advice": ["recommend", "encourage"], "Negative_Advice": ["reconsider", "wait"]}
    STEREOTYPE_CONCEPTS = {"Gender_Trait_Stereotypes": ["aggressive", "emotional"]}
    STEREOTYPE_SEVERITY = {"Gender_Trait_Stereotypes": 0.8}
    SENSITIVITY_THRESHOLD = 2.0
    MODEL_NAME = "all-mpnet-base-v2"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VerifairSentinel")

class VerifairSentinel:
    """
    The Bias Detection Engine.
    
    This class is responsible for ingesting text, vectorizing it using Sentence Transformers,
    and performing Z-Score analysis to detect statistically significant bias against specific identities.
    """

    def _precompute_embeddings(self, texts: List[str]) -> Any:
        return self.model.encode(texts, convert_to_tensor=True)

    def _precompute_embeddings_dict(self, dictionary: Dict[str, List[str]]) -> Dict[str, Any]:
        embeddings = {}
        for key, texts in dictionary.items():
            embeddings[key] = self.model.encode(texts, convert_to_tensor=True)
        return embeddings

    def _calculate_baseline_stats(self):
        generic_sentences = [
            "The employee completed the task on time.",
            "Meeting minutes were distributed.",
            "Revenue increased by 5% this quarter.",
            "The project timeline is on track.",
            "Please submit your reports by Friday."
        ]
        generic_emb = self.model.encode(generic_sentences, convert_to_tensor=True)
        all_sims = []
        for identity_emb in self.identity_embeddings:
            sims = util.cos_sim(identity_emb, generic_emb)
            all_sims.extend(sims.cpu().numpy().flatten())
        return np.mean(all_sims), np.std(all_sims)
        
    def __init__(self):
        """
        Initialize the Sentinel by loading the model and pre-computing identity embeddings.
        """
        logger.info(f"Loading weights: {MODEL_NAME}") # Modified log message
        try:
            self.model = SentenceTransformer(MODEL_NAME)
        except Exception as e:
            logger.error(f"Failed to load model {MODEL_NAME}: {e}")
            raise e
        
        logger.info("Pre-computing embeddings for Identity Terms...")
        self.identity_embeddings = self._precompute_embeddings(IDENTITIES) # Refactored
        
        # Pre-compute embeddings for Target Concepts for categorization
        self.concept_embeddings = self._precompute_embeddings_dict(TARGET_CONCEPTS) # Renamed and refactored
        
        # New: Quality Embeddings
        self.quality_embeddings = self._precompute_embeddings_dict(QUALITY_CONCEPTS) # Added
        
        # New: Advice Disparity Embeddings
        self.advice_disparity_embeddings = self._precompute_embeddings_dict(ADVICE_DISPARITY_CONCEPTS) # Added
        
        # New: Stereotype Embeddings (Industry-Standard Detection)
        self.stereotype_embeddings = self._precompute_embeddings_dict(STEREOTYPE_CONCEPTS) # Added
        
        # Calculate stats for Z-score normalization (Baseline calculation)
        self.baseline_mean, self.baseline_std = self._calculate_baseline_stats() # Added
        
        # New: Initialize SOTA Toxicity/Bias Pipeline (HuggingFace)
        logger.info("Loading SOTA Toxicity Detection Model (unitary/toxic-bert)...")
        try:
            self.toxicity_pipeline = pipeline("text-classification", model="unitary/toxic-bert", top_k=None)
        except Exception as e:
            logger.error(f"Failed to load toxicity pipeline: {e}")
            self.toxicity_pipeline = None

        logger.info("VerifairSentinel initialized successfully.")




    def batch_analyze(self, text_chunks: List[str]) -> List[Dict[str, Any]]:
        """
        Analyze a batch of text chunks for bias, topics, and quality.
        Returns a list of analysis results.
        """
        if not text_chunks:
            return []
            
        embeddings = self.model.encode(text_chunks, show_progress_bar=False)
        results = []
        
        for i, text in enumerate(text_chunks):
            current_embedding = embeddings[i]
            
            # 1. Bias Analysis
            bias_flags = self._detect_bias(current_embedding)
            
            # 2. Topic Categorization
            topics = self._categorize_topic(current_embedding)
            
            # 3. Quality Analysis (Vagueness Check)
            quality_score = self._analyze_quality(current_embedding)
            
            # 4. NEW: Advice Disparity Test
            advice_disparity = self._analyze_advice_disparity(current_embedding, text)
            
            # 5. NEW: Stereotype Bias Detection (Industry-Standard)
            stereotype_analysis = self._detect_stereotypes(current_embedding, text)
            
            results.append({
                "text_snippet": text,
                "is_biased": len(bias_flags) > 0,
                "bias_flags": bias_flags,
                "topics": topics,
                "quality_score": quality_score,
                "advice_disparity": advice_disparity,  # NEW
                "stereotype_analysis": stereotype_analysis,  # NEW
                "statistics": {
                    "mean_association": 0.0,  # Placeholder
                    "std_deviation": 0.0       # Placeholder
                }
            })
            
        return results

    def _analyze_quality(self, embedding: np.ndarray) -> float:
        """Calculate vagueness score (0-100) based on similarity to vague/subjective concepts."""
        max_sim = 0.0
        for category, ref_embeddings in self.quality_embeddings.items():
            sims = util.cos_sim(embedding, ref_embeddings)
            max_sim = max(max_sim, np.max(sims.cpu().numpy()))
        
        # Normalize: map similarity to 0-100 scale
        score = (max_sim - 0.15) * (100 / (0.6 - 0.15))
        return float(np.clip(score, 0, 100))

    def _detect_bias(self, embedding: np.ndarray) -> List[Dict[str, Any]]:
        """Detect bias using Z-score analysis."""
        identity_scores = util.cos_sim(embedding, self.identity_embeddings)[0].cpu().numpy()
        
        local_mean = np.mean(identity_scores)
        local_std = np.std(identity_scores)
        
        if local_std == 0:
            return []
        
        flags = []
        for idx, score in enumerate(identity_scores):
            z_score = (score - local_mean) / local_std
            if z_score > 2.0:  # Threshold
                flags.append({
                    "identity": IDENTITIES[idx],
                    "z_score": float(z_score),
                    "similarity_score": float(score),
                    "severity": "High" if z_score > 3.0 else "Medium"
                })
        return flags

    def _categorize_topic(self, embedding: np.ndarray) -> List[Dict[str, Any]]:
        """Categorize text into topics based on concept similarity."""
        topics = []
        for category, ref_embeddings in self.concept_embeddings.items():
            sims = util.cos_sim(embedding, ref_embeddings)
            max_sim = np.max(sims.cpu().numpy())
            if max_sim > 0.3:  # Topic relevance threshold
                topics.append({
                    "category": category,
                    "relevance_score": float(max_sim)
                })
        return topics

    def _analyze_advice_disparity(self, embedding: np.ndarray, text: str) -> Dict[str, Any]:
        """
        Analyze advice disparity - detects if different types of advice are given
        when different identities are mentioned in the text.
        
        Returns a disparity score and breakdown of advice types detected.
        """
        # Calculate similarity to each advice type
        advice_scores = {}
        for advice_type, ref_embeddings in self.advice_disparity_embeddings.items():
            sims = util.cos_sim(embedding, ref_embeddings)
            max_sim = np.max(sims.cpu().numpy())
            advice_scores[advice_type] = float(max_sim)
        
        # Detect which identities are mentioned in the text
        mentioned_identities = []
        text_lower = text.lower()
        for identity in IDENTITIES:
            if identity.lower() in text_lower:
                mentioned_identities.append(identity)
        
        # Determine dominant advice type
        dominant_advice = max(advice_scores, key=advice_scores.get) if advice_scores else None
        dominant_score = advice_scores.get(dominant_advice, 0.0) if dominant_advice else 0.0
        
        # Calculate disparity score (0-100)
        # Higher score means more disparity/differential treatment detected
        disparity_score = 0.0
        
        if mentioned_identities and dominant_score > 0.3:
            # Check if negative or conditional advice is given with identity mentions
            if dominant_advice in ["Negative_Advice", "Conditional_Advice"]:
                # Higher disparity if negative/conditional advice appears with identity mentions
                disparity_score = dominant_score * 100
            elif dominant_advice == "Directive_Advice":
                # Moderate disparity for directive advice
                disparity_score = dominant_score * 70
            else:
                # Lower disparity for positive advice
                disparity_score = dominant_score * 30
        
        return {
            "disparity_score": float(np.clip(disparity_score, 0, 100)),
            "mentioned_identities": mentioned_identities,
            "dominant_advice_type": dominant_advice,
            "advice_type_scores": advice_scores,
            "has_disparity": disparity_score > 50.0
        }

    def _detect_stereotypes(self, embedding: np.ndarray, text: str) -> Dict[str, Any]:
        """
        Detect stereotype bias using industry-standard methodologies.
        Based on StereoSet, CrowS-Pairs, and Regard Score frameworks.
        
        Returns comprehensive stereotype analysis with severity scoring.
        """
        # Calculate similarity to each stereotype category
        stereotype_scores = {}
        detected_categories = []
        
        # 1. New SOTA Model Check (Toxicity/Identity Hate)
        if self.toxicity_pipeline:
            try:
                # The pipeline returns a list of lists because input is a single string? No, standard pipeline call.
                # output: [[{'label': 'toxic', 'score': 0.9}, ...]] for list input, or [{'label'..., 'score'...}] for str?
                # pipeline(text) returns a list of results. For single text, it's a list.
                pipe_out = self.toxicity_pipeline(text)
                # Ensure structure
                if isinstance(pipe_out, list) and len(pipe_out) > 0 and isinstance(pipe_out[0], list):
                    scores = {item['label']: item['score'] for item in pipe_out[0]}
                elif isinstance(pipe_out, list):
                     scores = {item['label']: item['score'] for item in pipe_out}
                else:
                    scores = {}

                # Map toxicity labels to our framework
                # 'identity_hate' is the strongest signal for bias
                hate_score = scores.get('identity_hate', 0.0)
                insult_score = scores.get('insult', 0.0)
                toxic_score = scores.get('toxic', 0.0)
                
                if hate_score > 0.1 or insult_score > 0.3: # Low threshold because these are serious
                     stereotype_scores["Explicit_Identity_Bias"] = {
                        "max_similarity": float(max(hate_score, insult_score)),
                        "mean_similarity": float(max(hate_score, insult_score)),
                        "severity_weight": 1.0 # Maximum severity
                     }
                     detected_categories.append("Explicit_Identity_Bias")

            except Exception as e:
                logger.warning(f"Toxicity check failed: {e}")

        # 2. Embedding-based Similarity Check (Existing Logic)
        for category, ref_embeddings in self.stereotype_embeddings.items():
            sims = util.cos_sim(embedding, ref_embeddings)
            max_sim = np.max(sims.cpu().numpy())
            mean_sim = np.mean(sims.cpu().numpy())
            
            # Store both max and mean for better detection
            stereotype_scores[category] = {
                "max_similarity": float(max_sim),
                "mean_similarity": float(mean_sim),
                "severity_weight": STEREOTYPE_SEVERITY.get(category, 0.5)
            }
            
            # Threshold for detection (lower than bias detection due to subtlety)
            if max_sim > 0.35:  # Stereotypes can be more subtle
                detected_categories.append(category)
        
        # Detect which identities are mentioned in the text
        mentioned_identities = []
        text_lower = text.lower()
        for identity in IDENTITIES:
            if identity.lower() in text_lower:
                mentioned_identities.append(identity)
        
        # Calculate overall stereotype score (0-100)
        # Weighted by severity and presence of identity mentions
        stereotype_score = 0.0
        category_details = []
        
        for category in detected_categories:
            score_data = stereotype_scores[category]
            base_score = score_data["max_similarity"] * 100
            severity_weight = score_data["severity_weight"]
            
            # Amplify score if identities are mentioned
            identity_multiplier = 1.5 if mentioned_identities else 1.0
            
            # Calculate weighted score
            weighted_score = base_score * severity_weight * identity_multiplier
            
            category_details.append({
                "category": category,
                "similarity": score_data["max_similarity"],
                "severity": severity_weight,
                "weighted_score": float(weighted_score)
            })
            
            # Accumulate to overall score (take max, not sum, to avoid inflation)
            stereotype_score = max(stereotype_score, weighted_score)
        
        # Determine stereotype type (for user-friendly display)
        stereotype_type = None
        if detected_categories:
            # Find the highest scoring category
            highest_category = max(
                detected_categories,
                key=lambda cat: stereotype_scores[cat]["max_similarity"] * STEREOTYPE_SEVERITY.get(cat, 0.5)
            )
            # Convert to readable format
            stereotype_type = highest_category.replace('_', ' ').title()
        
        # Determine severity level
        severity_level = "None"
        if stereotype_score > 75:
            severity_level = "Critical"
        elif stereotype_score > 60:
            severity_level = "High"
        elif stereotype_score > 45:
            severity_level = "Medium"
        elif stereotype_score > 30:
            severity_level = "Low"
        
        return {
            "stereotype_score": float(np.clip(stereotype_score, 0, 100)),
            "has_stereotype": stereotype_score > 30.0,
            "severity_level": severity_level,
            "stereotype_type": stereotype_type,
            "detected_categories": detected_categories,
            "category_details": category_details,
            "mentioned_identities": mentioned_identities,
            "all_category_scores": {
                cat: scores["max_similarity"] 
                for cat, scores in stereotype_scores.items()
            }
        }


# Example usage for testing
if __name__ == "__main__":
    sentinel = VerifairSentinel()
    
    test_sentences = [
        "The candidate is aggressive and dangerous.", # Potential implicit bias check
        "She is a natural leader and executive.",
        "The doctor performed the surgery successfully.",
        "The young engineer struggled with the legacy code."
    ]
    
    print(f"--- Running Sentinel Test on {len(test_sentences)} chunks ---")
    for text in test_sentences:
        report = sentinel.analyze_chunk(text)
        if report["is_biased"]:
            print(f"[ALERT] Bias Detected in: '{text}'")
            print(f"       Flags: {report['bias_flags']}")
        else:
            print(f"[OK] No significant bias in: '{text}'")
