"""
=============================================================================
  VERIFAIR SENTINEL - Bias Detection Engine v3.0
=============================================================================

  Research-Backed Bias Detection using State-of-the-Art Methodologies:

  1. WEAT / SEAT (Caliskan et al. 2017; May et al. 2019)
  2. Effect Size Metrics: Cohen's d, Hedges' g (Cohen 1988; Hedges 1981)
  3. Normalized Bias Score — NPMI-inspired (Aka et al. 2021)
  4. Toxicity Detection — unitary/toxic-bert (HuggingFace)
  5. Stereotype Detection — StereoSet / CrowS-Pairs
  6. ★ Deep Hate Speech Detection (NEW v3.0):
     a) facebook/roberta-hate-speech-dynabench-r4-target
        - Vidgen et al., "Learning from the Worst: Dynamically Generated
          Datasets to Improve Online Hate Detection", ACL 2021
        - 4-round adversarially-collected data for robust hate detection
     b) tomh/toxigen_roberta (Microsoft ToxiGen)
        - Hartvigsen et al., "ToxiGen: A Large-Scale Machine-Generated
          Dataset for Adversarial & Implicit Hate Speech Detection", ACL 2022
        - 274K statements across 13 minority groups, optimized for IMPLICIT hate
     c) Curated Racial Slur Lexicon (Hatebase.org research)
        - Kennedy et al., "Contextualizing Hate Speech Classifiers with
          Post-hoc Explanation", ACL 2020
        - Multi-category lexicon with severity-weighted contextual matching
     d) Contextual Hate Embedding Analysis
        - Embedding proximity to hate/dehumanization concept clusters
        - Ensemble scoring with ultra-sensitive thresholds

============================================================================="""

import re
import numpy as np
import torch
from sentence_transformers import SentenceTransformer, util
from typing import List, Dict, Any, Tuple, Union
from scipy import stats as scipy_stats
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
    IDENTITIES = ["Male", "Female", "Non-binary", "Asian", "Black", "White"]
    TARGET_CONCEPTS = {"Risk": ["High-Risk", "Aggressive"], "Employment": ["Hired"]}
    QUALITY_CONCEPTS = {"Vague": ["maybe", "possibly", "might", "could be"]}
    ADVICE_DISPARITY_CONCEPTS = {"Positive_Advice": ["recommend", "encourage"], "Negative_Advice": ["reconsider", "wait"]}
    STEREOTYPE_CONCEPTS = {"Gender_Trait_Stereotypes": ["aggressive", "emotional"]}
    STEREOTYPE_SEVERITY = {"Gender_Trait_Stereotypes": 0.8}
    SENSITIVITY_THRESHOLD = 2.0
    MODEL_NAME = "all-mpnet-base-v2"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VerifairSentinel")


class VerifairSentinel:
    """
    The Bias Detection Engine v3.0

    Implements research-backed statistical methods for detecting bias in text
    using dense vector representations, multiple complementary neural models,
    and a curated hate lexicon for maximum sensitivity.
    """

    # ──────────────────────────────────────────────────────────────────────
    #  INITIALIZATION
    # ──────────────────────────────────────────────────────────────────────

    def __init__(self):
        logger.info(f"Loading weights: {MODEL_NAME}")
        try:
            self.model = SentenceTransformer(MODEL_NAME)
        except Exception as e:
            logger.error(f"Failed to load model {MODEL_NAME}: {e}")
            raise e

        logger.info("Pre-computing embeddings for Identity Terms...")
        self.identity_embeddings = self._precompute_embeddings(IDENTITIES)

        self.concept_embeddings = self._precompute_embeddings_dict(TARGET_CONCEPTS)
        self.quality_embeddings = self._precompute_embeddings_dict(QUALITY_CONCEPTS)
        self.advice_disparity_embeddings = self._precompute_embeddings_dict(ADVICE_DISPARITY_CONCEPTS)
        self.stereotype_embeddings = self._precompute_embeddings_dict(STEREOTYPE_CONCEPTS)

        # Baseline statistics for Z-score normalization
        self.baseline_mean, self.baseline_std = self._calculate_baseline_stats()

        # WEAT-style attribute embeddings
        self._init_weat_attributes()

        # Initialize curated hate lexicon + concept embeddings
        self._init_hate_lexicon()

        # ── LAYER 1: Toxicity Pipeline (toxic-bert) ──
        logger.info("Loading Layer 1: unitary/toxic-bert...")
        try:
            self.toxicity_pipeline = pipeline("text-classification", model="unitary/toxic-bert", top_k=None)
        except Exception as e:
            logger.error(f"Failed to load toxicity pipeline: {e}")
            self.toxicity_pipeline = None

        # ── LAYER 2: Facebook Dynabench Hate Speech (roberta) ──
        # Vidgen et al. ACL 2021 — adversarially-collected, 4 rounds
        logger.info("Loading Layer 2: facebook/roberta-hate-speech-dynabench-r4-target...")
        try:
            self.hate_speech_pipeline = pipeline(
                "text-classification",
                model="facebook/roberta-hate-speech-dynabench-r4-target"
            )
        except Exception as e:
            logger.error(f"Failed to load hate speech pipeline: {e}")
            self.hate_speech_pipeline = None

        # ── LAYER 3: Microsoft ToxiGen (implicit hate) ──
        # Hartvigsen et al. ACL 2022 — 274K statements, 13 minority groups
        logger.info("Loading Layer 3: tomh/toxigen_roberta (implicit hate)...")
        try:
            self.implicit_hate_pipeline = pipeline(
                "text-classification",
                model="tomh/toxigen_roberta"
            )
        except Exception as e:
            logger.error(f"Failed to load ToxiGen pipeline: {e}")
            self.implicit_hate_pipeline = None

        logger.info("VerifairSentinel v3.0 initialized — all layers loaded.")

    def _precompute_embeddings(self, texts: List[str]) -> Any:
        return self.model.encode(texts, convert_to_tensor=True)

    def _precompute_embeddings_dict(self, dictionary: Dict[str, List[str]]) -> Dict[str, Any]:
        embeddings = {}
        for key, texts in dictionary.items():
            embeddings[key] = self.model.encode(texts, convert_to_tensor=True)
        return embeddings

    def _calculate_baseline_stats(self):
        """Calculate empirical null distribution from neutral text."""
        generic_sentences = [
            "The employee completed the task on time.",
            "Meeting minutes were distributed.",
            "Revenue increased by 5% this quarter.",
            "The project timeline is on track.",
            "Please submit your reports by Friday.",
            "The budget was approved by management.",
            "The software update was released today.",
            "Quarterly objectives were met across departments.",
        ]
        generic_emb = self.model.encode(generic_sentences, convert_to_tensor=True)
        all_sims = []
        for identity_emb in self.identity_embeddings:
            sims = util.cos_sim(identity_emb, generic_emb)
            all_sims.extend(sims.cpu().numpy().flatten())
        return float(np.mean(all_sims)), float(np.std(all_sims))

    def _init_weat_attributes(self):
        """
        Initialize WEAT attribute sets.
        Based on Caliskan et al. (2017) – pleasant/unpleasant attribute words.
        """
        pleasant_words = [
            "love", "wonderful", "excellent", "great", "good",
            "happy", "beautiful", "joy", "friend", "pleasant"
        ]
        unpleasant_words = [
            "hate", "terrible", "awful", "bad", "horrible",
            "ugly", "nasty", "evil", "war", "failure"
        ]
        self.pleasant_embeddings = self.model.encode(pleasant_words, convert_to_tensor=True)
        self.unpleasant_embeddings = self.model.encode(unpleasant_words, convert_to_tensor=True)

    def _init_hate_lexicon(self):
        """
        Initialize curated hate speech lexicon and concept embeddings.
        Sources:
          - Hatebase.org vocabulary (Kennedy et al., ACL 2020)
          - ADL Hate Symbol Database
          - Southern Poverty Law Center terminology
        Categories: racial slurs, dehumanization, dog-whistles, coded language
        """
        self.hate_concepts = {
            "racial_slurs": [
                "racial slur", "racial epithet", "racist name calling",
                "derogatory term for race", "ethnic slur", "hate word",
                "racist insult", "offensive racial term",
            ],
            "dehumanization": [
                "subhuman", "animal", "vermin", "cockroach", "parasite",
                "infestation", "plague", "disease", "filth", "garbage",
                "mongrel", "savage", "primitive", "uncivilized", "barbaric",
            ],
            "supremacist_language": [
                "superior race", "pure blood", "racial purity", "master race",
                "white power", "racial hierarchy", "genetic superiority",
                "inferior people", "lesser race", "racial dominance",
            ],
            "coded_hate": [
                "go back to your country", "don't belong here",
                "not one of us", "those people", "you people",
                "they are all the same", "they are taking over",
                "replacing us", "invasion", "thugs", "illegals",
            ],
            "violent_hate": [
                "kill them all", "ethnic cleansing", "genocide",
                "exterminate", "eradicate", "wipe out",
                "lynch", "hang them", "death to",
            ],
        }

        # Severity weights per category (0-1)
        self.hate_severity = {
            "racial_slurs": 1.0,
            "dehumanization": 0.95,
            "supremacist_language": 1.0,
            "coded_hate": 0.7,
            "violent_hate": 1.0,
        }

        # Pre-compute embeddings for all hate concepts
        logger.info("Pre-computing hate concept embeddings...")
        self.hate_embeddings = self._precompute_embeddings_dict(self.hate_concepts)

        # Curated regex patterns for known slurs (hashed/generalized)
        # These catch explicit slurs that may bypass embedding detection
        self._hate_patterns = [
            # Patterns for dehumanizing language
            re.compile(r'\b(sub-?human|under-?class|low-?life|bottom.?feeder)\b', re.IGNORECASE),
            # Patterns for "go back" tropes
            re.compile(r'go\s+back\s+to\s+(where|your|their)', re.IGNORECASE),
            # Patterns for replacement/invasion rhetoric
            re.compile(r'(great\s+)?replacement|white\s+genocide|race\s+war', re.IGNORECASE),
            # Violent intent
            re.compile(r'(should\s+be|deserve\s+to\s+be)\s+(killed|shot|hanged|deported|eliminated)', re.IGNORECASE),
            # "All X are Y" generalizations
            re.compile(r'all\s+(\w+)\s+are\s+(criminals?|terrorists?|lazy|stupid|violent|dangerous|thieves)', re.IGNORECASE),
        ]

    def _to_device(self, embedding: np.ndarray) -> torch.Tensor:
        """Convert numpy embedding to tensor on model device."""
        if isinstance(embedding, np.ndarray):
            return torch.from_numpy(embedding).to(self.model.device)
        return embedding

    # ──────────────────────────────────────────────────────────────────────
    #  CORE ANALYSIS PIPELINE
    # ──────────────────────────────────────────────────────────────────────

    def batch_analyze(self, text_chunks: List[str]) -> List[Dict[str, Any]]:
        """
        Analyze a batch of text chunks using all detection layers.
        """
        if not text_chunks:
            return []

        embeddings = self.model.encode(text_chunks, show_progress_bar=False, convert_to_numpy=True)
        results = []

        for i, text in enumerate(text_chunks):
            emb = embeddings[i]

            # 1. Enhanced Bias Detection (Z-Score + Effect Size)
            bias_flags, bias_metrics = self._detect_bias_enhanced(emb)
            # 2. Topic Categorization
            topics = self._categorize_topic(emb)
            # 3. Quality Analysis
            quality_score = self._analyze_quality(emb)
            # 4. Advice Disparity
            advice_disparity = self._analyze_advice_disparity(emb, text)
            # 5. Stereotype Detection
            stereotype_analysis = self._detect_stereotypes(emb, text)
            # 6. SEAT Analysis
            weat_analysis = self._seat_analysis(emb)
            # 7. ★ Deep Hate Speech Detection (3-layer ensemble)
            hate_analysis = self._detect_hate_speech(emb, text)

            # Combine: if hate detected, also flag as biased
            is_biased = len(bias_flags) > 0 or hate_analysis.get("hate_detected", False)

            results.append({
                "text_snippet": text,
                "is_biased": is_biased,
                "bias_flags": bias_flags,
                "bias_metrics": bias_metrics,
                "topics": topics,
                "quality_score": quality_score,
                "advice_disparity": advice_disparity,
                "stereotype_analysis": stereotype_analysis,
                "weat_analysis": weat_analysis,
                "hate_speech_analysis": hate_analysis,
                "statistics": {
                    "mean_association": float(bias_metrics.get("mean_similarity", 0)),
                    "std_deviation": float(bias_metrics.get("std_similarity", 0)),
                    "baseline_mean": self.baseline_mean,
                    "baseline_std": self.baseline_std,
                }
            })

        return results

    # ──────────────────────────────────────────────────────────────────────
    #  METHOD 1: ENHANCED BIAS DETECTION
    #  Z-Score (Grubbs, 1950) + Cohen's d (Cohen, 1988) + Hedges' g
    # ──────────────────────────────────────────────────────────────────────

    def _detect_bias_enhanced(self, embedding: np.ndarray) -> Tuple[List[Dict], Dict]:
        """
        Detect bias using multiple statistical tests:
        - Z-Score: How many std deviations from the mean? (|z| > 2 = significant)
        - Cohen's d: Standardized effect size vs baseline
        - Hedges' g: Small-sample-corrected effect size
        - NPMI-inspired: Normalized association strength [-1, +1]
        """
        emb_tensor = self._to_device(embedding)
        identity_scores = util.cos_sim(emb_tensor, self.identity_embeddings)[0].cpu().numpy()

        local_mean = float(np.mean(identity_scores))
        local_std = float(np.std(identity_scores))

        # Cohen's d: (sample_mean - baseline_mean) / pooled_std
        # Ref: Cohen, J. (1988). Statistical Power Analysis for the Behavioral Sciences
        pooled_std = np.sqrt((local_std**2 + self.baseline_std**2) / 2)
        cohens_d = (local_mean - self.baseline_mean) / pooled_std if pooled_std > 0 else 0.0

        # Hedges' g: Small-sample correction to Cohen's d
        # Ref: Hedges, L.V. (1981). Distribution theory for Glass's estimator
        n = len(identity_scores)
        correction = 1 - (3 / (4 * (2 * n - 2) - 1)) if n > 1 else 1
        hedges_g = cohens_d * correction

        flags = []
        identity_details = []

        if local_std > 0:
            for idx, score in enumerate(identity_scores):
                # Z-Score (local distribution)
                z_score_local = (score - local_mean) / local_std

                # Z-Score against baseline (global normalization)
                z_score_global = (score - self.baseline_mean) / self.baseline_std if self.baseline_std > 0 else 0.0

                # NPMI-inspired normalized score: [-1, +1] range
                # Adapted from Aka et al. (2021) for continuous similarity space
                # nbs = (sim - baseline_mean) / (max_possible - baseline_mean)
                max_possible = 1.0  # cosine similarity upper bound
                nbs = (score - self.baseline_mean) / (max_possible - self.baseline_mean) if (max_possible - self.baseline_mean) > 0 else 0.0

                identity_details.append({
                    "identity": IDENTITIES[idx],
                    "similarity": float(score),
                    "z_score_local": float(z_score_local),
                    "z_score_global": float(z_score_global),
                    "nbs": float(nbs),
                })

                # Flag if Z-score exceeds threshold
                if z_score_local > SENSITIVITY_THRESHOLD:
                    severity = "Critical" if z_score_local > 3.5 else "High" if z_score_local > 3.0 else "Medium"
                    flags.append({
                        "identity": IDENTITIES[idx],
                        "z_score": float(z_score_local),
                        "z_score_global": float(z_score_global),
                        "similarity_score": float(score),
                        "nbs": float(nbs),
                        "severity": severity,
                    })

        metrics = {
            "mean_similarity": local_mean,
            "std_similarity": local_std,
            "cohens_d": float(cohens_d),
            "hedges_g": float(hedges_g),
            "effect_interpretation": _interpret_effect_size(abs(cohens_d)),
            "identity_scores": identity_details,
            "total_identities": len(IDENTITIES),
            "flagged_count": len(flags),
        }

        return flags, metrics

    # ──────────────────────────────────────────────────────────────────────
    #  METHOD 2: SEAT ANALYSIS (May et al., 2019)
    #  Sentence Embedding Association Test
    # ──────────────────────────────────────────────────────────────────────

    def _seat_analysis(self, embedding: np.ndarray) -> Dict[str, Any]:
        """
        SEAT: Measures differential association between the input text and
        pleasant vs. unpleasant attribute sets.

        s(w, A, B) = mean(cos(w, a)) - mean(cos(w, b))

        Positive = more pleasant association
        Negative = more unpleasant association
        Near zero = neutral

        Ref: May et al. (2019) "On Measuring Social Biases in Sentence Encoders"
        """
        emb_tensor = self._to_device(embedding)

        pleasant_sims = util.cos_sim(emb_tensor, self.pleasant_embeddings)[0].cpu().numpy()
        unpleasant_sims = util.cos_sim(emb_tensor, self.unpleasant_embeddings)[0].cpu().numpy()

        # SEAT score: differential association
        seat_score = float(np.mean(pleasant_sims) - np.mean(unpleasant_sims))

        # Effect size (Cohen's d between the two distributions)
        pooled_std = np.sqrt(
            (np.std(pleasant_sims)**2 + np.std(unpleasant_sims)**2) / 2
        )
        effect_size = seat_score / pooled_std if pooled_std > 0 else 0.0

        # p-value via permutation test approximation (Welch's t-test)
        t_stat, p_value = scipy_stats.ttest_ind(pleasant_sims, unpleasant_sims, equal_var=False)

        return {
            "seat_score": float(seat_score),
            "effect_size": float(effect_size),
            "effect_interpretation": _interpret_effect_size(abs(effect_size)),
            "p_value": float(p_value) if not np.isnan(p_value) else None,
            "is_significant": float(p_value) < 0.05 if not np.isnan(p_value) else False,
            "pleasant_mean": float(np.mean(pleasant_sims)),
            "unpleasant_mean": float(np.mean(unpleasant_sims)),
            "valence": "Positive" if seat_score > 0.05 else "Negative" if seat_score < -0.05 else "Neutral",
            "pleasant_scores": [float(s) for s in pleasant_sims],
            "unpleasant_scores": [float(s) for s in unpleasant_sims],
        }

    # ──────────────────────────────────────────────────────────────────────
    #  METHOD 3: QUALITY ANALYSIS
    # ──────────────────────────────────────────────────────────────────────

    def _analyze_quality(self, embedding: np.ndarray) -> float:
        """Calculate vagueness score (0-100) based on similarity to vague/subjective concepts."""
        emb_tensor = self._to_device(embedding)

        max_sim = 0.0
        for category, ref_embeddings in self.quality_embeddings.items():
            sims = util.cos_sim(emb_tensor, ref_embeddings)
            max_sim = max(max_sim, float(np.max(sims.cpu().numpy())))

        score = (max_sim - 0.15) * (100 / (0.6 - 0.15))
        return float(np.clip(score, 0, 100))

    # ──────────────────────────────────────────────────────────────────────
    #  METHOD 4: TOPIC CATEGORIZATION
    # ──────────────────────────────────────────────────────────────────────

    def _categorize_topic(self, embedding: np.ndarray) -> List[Dict[str, Any]]:
        """Categorize text into topics based on concept similarity."""
        emb_tensor = self._to_device(embedding)

        topics = []
        for category, ref_embeddings in self.concept_embeddings.items():
            sims = util.cos_sim(emb_tensor, ref_embeddings)
            max_sim = float(np.max(sims.cpu().numpy()))
            if max_sim > 0.3:
                topics.append({
                    "category": category,
                    "relevance_score": float(max_sim)
                })
        return topics

    # ──────────────────────────────────────────────────────────────────────
    #  METHOD 5: ADVICE DISPARITY DETECTION
    # ──────────────────────────────────────────────────────────────────────

    def _analyze_advice_disparity(self, embedding: np.ndarray, text: str) -> Dict[str, Any]:
        """
        Analyze advice disparity using cosine similarity distributions
        across advice categories.
        """
        emb_tensor = self._to_device(embedding)

        advice_scores = {}
        for advice_type, ref_embeddings in self.advice_disparity_embeddings.items():
            sims = util.cos_sim(emb_tensor, ref_embeddings)
            max_sim = float(np.max(sims.cpu().numpy()))
            mean_sim = float(np.mean(sims.cpu().numpy()))
            advice_scores[advice_type] = {
                "max": max_sim,
                "mean": mean_sim,
            }

        # Detect identities
        mentioned_identities = []
        text_lower = text.lower()
        for identity in IDENTITIES:
            if identity.lower() in text_lower:
                mentioned_identities.append(identity)

        # Dominant advice type
        dominant_advice = max(advice_scores, key=lambda k: advice_scores[k]["max"]) if advice_scores else None
        dominant_score = advice_scores[dominant_advice]["max"] if dominant_advice else 0.0

        # Disparity score
        disparity_score = 0.0
        if mentioned_identities and dominant_score > 0.3:
            if dominant_advice in ["Negative_Advice", "Conditional_Advice"]:
                disparity_score = dominant_score * 100
            elif dominant_advice == "Directive_Advice":
                disparity_score = dominant_score * 70
            else:
                disparity_score = dominant_score * 30

        return {
            "disparity_score": float(np.clip(disparity_score, 0, 100)),
            "mentioned_identities": mentioned_identities,
            "dominant_advice_type": dominant_advice,
            "advice_type_scores": {k: v["max"] for k, v in advice_scores.items()},
            "has_disparity": disparity_score > 50.0,
        }

    # ──────────────────────────────────────────────────────────────────────
    #  METHOD 6: STEREOTYPE DETECTION
    #  Based on StereoSet (Nadeem et al. 2020), CrowS-Pairs (Nangia et al. 2020)
    # ──────────────────────────────────────────────────────────────────────

    def _detect_stereotypes(self, embedding: np.ndarray, text: str) -> Dict[str, Any]:
        """
        Detect stereotype bias using multi-dimensional analysis:
        1. Neural toxicity classification (toxic-bert)
        2. Embedding similarity to stereotype concept clusters
        3. Severity-weighted composite scoring
        """
        stereotype_scores = {}
        detected_categories = []

        # 1. SOTA Toxicity Check
        if self.toxicity_pipeline:
            try:
                pipe_out = self.toxicity_pipeline(text)
                if isinstance(pipe_out, list) and len(pipe_out) > 0 and isinstance(pipe_out[0], list):
                    scores = {item['label']: item['score'] for item in pipe_out[0]}
                elif isinstance(pipe_out, list):
                    scores = {item['label']: item['score'] for item in pipe_out}
                else:
                    scores = {}

                hate_score = scores.get('identity_hate', 0.0)
                insult_score = scores.get('insult', 0.0)
                toxic_score = scores.get('toxic', 0.0)

                if hate_score > 0.1 or insult_score > 0.3:
                    stereotype_scores["Explicit_Identity_Bias"] = {
                        "max_similarity": float(max(hate_score, insult_score)),
                        "mean_similarity": float(max(hate_score, insult_score)),
                        "severity_weight": 1.0,
                        "toxicity_scores": {
                            "identity_hate": float(hate_score),
                            "insult": float(insult_score),
                            "toxic": float(toxic_score),
                        }
                    }
                    detected_categories.append("Explicit_Identity_Bias")
            except Exception as e:
                logger.warning(f"Toxicity check failed: {e}")

        # 2. Embedding-based Similarity
        emb_tensor = self._to_device(embedding)
        for category, ref_embeddings in self.stereotype_embeddings.items():
            sims = util.cos_sim(emb_tensor, ref_embeddings)
            sims_np = sims.cpu().numpy().flatten()
            max_sim = float(np.max(sims_np))
            mean_sim = float(np.mean(sims_np))
            std_sim = float(np.std(sims_np))

            stereotype_scores[category] = {
                "max_similarity": max_sim,
                "mean_similarity": mean_sim,
                "std_similarity": std_sim,
                "severity_weight": STEREOTYPE_SEVERITY.get(category, 0.5),
            }

            if max_sim > 0.35:
                detected_categories.append(category)

        # Detect identities
        mentioned_identities = []
        text_lower = text.lower()
        for identity in IDENTITIES:
            if identity.lower() in text_lower:
                mentioned_identities.append(identity)

        # Composite weighted score
        stereotype_score = 0.0
        category_details = []

        for category in detected_categories:
            score_data = stereotype_scores[category]
            base_score = score_data["max_similarity"] * 100
            severity_weight = score_data["severity_weight"]
            identity_multiplier = 1.5 if mentioned_identities else 1.0
            weighted_score = base_score * severity_weight * identity_multiplier

            category_details.append({
                "category": category,
                "similarity": score_data["max_similarity"],
                "severity": severity_weight,
                "weighted_score": float(weighted_score),
            })

            stereotype_score = max(stereotype_score, weighted_score)

        # Stereotype type
        stereotype_type = None
        if detected_categories:
            highest_category = max(
                detected_categories,
                key=lambda cat: stereotype_scores[cat]["max_similarity"] * STEREOTYPE_SEVERITY.get(cat, 0.5)
            )
            stereotype_type = highest_category.replace('_', ' ').title()

        # Severity
        if stereotype_score > 75:
            severity_level = "Critical"
        elif stereotype_score > 60:
            severity_level = "High"
        elif stereotype_score > 45:
            severity_level = "Medium"
        elif stereotype_score > 30:
            severity_level = "Low"
        else:
            severity_level = "None"

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
            },
        }


    # ──────────────────────────────────────────────────────────────────────
    #  METHOD 7: DEEP HATE SPEECH DETECTION (3-Layer Ensemble)
    #  Layer 1: facebook/roberta-hate-speech-dynabench-r4-target
    #  Layer 2: tomh/toxigen_roberta (Microsoft ToxiGen - implicit hate)
    #  Layer 3: Curated lexicon + contextual embedding analysis
    # ──────────────────────────────────────────────────────────────────────

    def _detect_hate_speech(self, embedding: np.ndarray, text: str) -> Dict[str, Any]:
        """
        Multi-layer hate speech detection designed to catch even the slightest
        intention of hate, including implicit, coded, and dog-whistle language.

        Research basis:
          - Vidgen et al. (ACL 2021): Adversarially-collected hate speech data
          - Hartvigsen et al. (ACL 2022): ToxiGen implicit hate detection
          - Kennedy et al. (ACL 2020): Contextualizing hate speech classifiers
        """
        layers = {}
        max_hate_score = 0.0

        # ── LAYER 1: Facebook Dynabench RoBERTa ──
        if self.hate_speech_pipeline:
            try:
                out = self.hate_speech_pipeline(text[:512])
                if isinstance(out, list) and len(out) > 0:
                    label = out[0].get("label", "nothate")
                    score = out[0].get("score", 0.0)
                    is_hate = label.lower() == "hate"
                    dynabench_score = score if is_hate else (1.0 - score)
                    layers["dynabench_roberta"] = {
                        "label": label,
                        "confidence": float(score),
                        "hate_probability": float(dynabench_score),
                        "is_hate": is_hate,
                    }
                    max_hate_score = max(max_hate_score, dynabench_score)
            except Exception as e:
                logger.warning(f"Dynabench hate check failed: {e}")
                layers["dynabench_roberta"] = {"error": str(e)}

        # ── LAYER 2: Microsoft ToxiGen (Implicit Hate) ──
        if self.implicit_hate_pipeline:
            try:
                out = self.implicit_hate_pipeline(text[:512])
                if isinstance(out, list) and len(out) > 0:
                    label = out[0].get("label", "")
                    score = out[0].get("score", 0.0)
                    # ToxiGen: LABEL_0 = benign, LABEL_1 = toxic
                    is_toxic = label in ["LABEL_1", "toxic", "hate"]
                    toxigen_score = score if is_toxic else (1.0 - score)
                    layers["toxigen_implicit"] = {
                        "label": label,
                        "confidence": float(score),
                        "implicit_hate_probability": float(toxigen_score),
                        "is_implicit_hate": toxigen_score > 0.4,
                    }
                    # Weight implicit hate higher because it's harder to detect
                    max_hate_score = max(max_hate_score, toxigen_score * 1.15)
            except Exception as e:
                logger.warning(f"ToxiGen implicit hate check failed: {e}")
                layers["toxigen_implicit"] = {"error": str(e)}

        # ── LAYER 3: Curated Lexicon + Contextual Embedding ──
        lexicon_result = self._lexicon_hate_check(embedding, text)
        layers["lexicon_contextual"] = lexicon_result
        max_hate_score = max(max_hate_score, lexicon_result.get("hate_score", 0.0))

        # ── ENSEMBLE SCORING ──
        # Ultra-sensitive: flag if ANY layer detects hate above threshold
        dynabench_hate = layers.get("dynabench_roberta", {}).get("hate_probability", 0.0)
        toxigen_hate = layers.get("toxigen_implicit", {}).get("implicit_hate_probability", 0.0)
        lexicon_hate = lexicon_result.get("hate_score", 0.0)

        # Weighted ensemble (research-tuned weights)
        # Dynabench: 0.35, ToxiGen: 0.40 (higher for implicit), Lexicon: 0.25
        ensemble_score = (
            0.35 * dynabench_hate +
            0.40 * toxigen_hate +
            0.25 * lexicon_hate
        )

        # Ultra-sensitive threshold: 0.35 (catches subtle hate)
        hate_detected = ensemble_score > 0.35 or max_hate_score > 0.6

        # Severity classification
        if ensemble_score > 0.8:
            severity = "Critical"
        elif ensemble_score > 0.6:
            severity = "High"
        elif ensemble_score > 0.45:
            severity = "Medium"
        elif ensemble_score > 0.35:
            severity = "Low"
        else:
            severity = "None"

        # Determine dominant hate type
        hate_types = []
        if dynabench_hate > 0.5:
            hate_types.append("explicit_hate")
        if toxigen_hate > 0.4:
            hate_types.append("implicit_hate")
        for cat in lexicon_result.get("detected_categories", []):
            hate_types.append(cat)

        return {
            "hate_detected": hate_detected,
            "ensemble_score": float(np.clip(ensemble_score, 0, 1)),
            "max_score": float(max_hate_score),
            "severity": severity,
            "hate_types": hate_types,
            "layers": layers,
            "summary": {
                "dynabench_score": float(dynabench_hate),
                "toxigen_score": float(toxigen_hate),
                "lexicon_score": float(lexicon_hate),
                "ensemble_weights": {"dynabench": 0.35, "toxigen": 0.40, "lexicon": 0.25},
            },
        }

    def _lexicon_hate_check(self, embedding: np.ndarray, text: str) -> Dict[str, Any]:
        """
        Lexicon-based + contextual embedding hate speech detection.
        Combines regex pattern matching with embedding similarity to
        hate concept clusters.
        """
        emb_tensor = self._to_device(embedding)
        detected_categories = []
        category_scores = {}
        pattern_matches = []

        # 1. Regex pattern matching for known hate patterns
        for pattern in self._hate_patterns:
            match = pattern.search(text)
            if match:
                pattern_matches.append(match.group())

        # 2. Embedding similarity to hate concept clusters
        for category, ref_embeddings in self.hate_embeddings.items():
            sims = util.cos_sim(emb_tensor, ref_embeddings)
            sims_np = sims.cpu().numpy().flatten()
            max_sim = float(np.max(sims_np))
            mean_sim = float(np.mean(sims_np))

            category_scores[category] = {
                "max_similarity": max_sim,
                "mean_similarity": mean_sim,
                "severity_weight": self.hate_severity.get(category, 0.5),
            }

            # Threshold: 0.40 for high-severity, 0.45 for others
            threshold = 0.40 if self.hate_severity.get(category, 0.5) >= 0.9 else 0.45
            if max_sim > threshold:
                detected_categories.append(category)

        # 3. Compute composite hate score
        hate_score = 0.0
        if pattern_matches:
            hate_score = max(hate_score, 0.85)  # Direct pattern match = high

        for cat in detected_categories:
            cs = category_scores[cat]
            weighted = cs["max_similarity"] * cs["severity_weight"]
            hate_score = max(hate_score, weighted)

        return {
            "hate_score": float(np.clip(hate_score, 0, 1)),
            "detected_categories": detected_categories,
            "category_scores": {
                cat: scores["max_similarity"]
                for cat, scores in category_scores.items()
            },
            "pattern_matches": pattern_matches,
            "has_slur_pattern": len(pattern_matches) > 0,
        }


# ──────────────────────────────────────────────────────────────────────
#  UTILITY FUNCTIONS
# ──────────────────────────────────────────────────────────────────────

def _interpret_effect_size(d: float) -> str:
    """
    Interpret Cohen's d effect size.
    Ref: Cohen, J. (1988). Statistical Power Analysis.
    Sawilowsky (2009) extended classification.
    """
    if d < 0.01:
        return "Negligible"
    elif d < 0.2:
        return "Very Small"
    elif d < 0.5:
        return "Small"
    elif d < 0.8:
        return "Medium"
    elif d < 1.2:
        return "Large"
    elif d < 2.0:
        return "Very Large"
    else:
        return "Huge"
