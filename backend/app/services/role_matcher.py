"""
Role Matcher Service - Zero-Shot Classification
Exact same logic as original Backend/app/services/role_matcher.py
"""

import re
import logging
from typing import Optional, Dict
import numpy as np

logger = logging.getLogger(__name__)

_zero_shot_classifier = None


def get_zero_shot_classifier():
    """Load Zero-Shot Classification model (BART-large-MNLI)."""
    global _zero_shot_classifier
    if _zero_shot_classifier is None:
        try:
            from transformers import pipeline
            import torch

            logger.info("⏳ Loading Zero-Shot Classifier (facebook/bart-large-mnli)...")
            device = 0 if torch.cuda.is_available() else -1
            _zero_shot_classifier = pipeline(
                "zero-shot-classification",
                model="facebook/bart-large-mnli",
                device=device,
            )
            logger.info("✅ Zero-Shot Classifier Loaded Successfully.")
        except Exception as e:
            logger.error(f"Failed to load Zero-Shot Classifier: {e}")
            raise
    return _zero_shot_classifier


def extract_text_segment(text: str, max_chars: int = 1000) -> str:
    """Helper to safely get start of text."""
    if not text:
        return ""
    return text[:max_chars].replace("\n", " ").strip()


def clean_role_name(title: str) -> str:
    """Extracts only the core role name for better AI matching."""
    if not title:
        return "Candidate"
    clean = re.sub(r'[\(\[\{].*?[\)\]\}]', '', title)
    clean = re.sub(r'(?i)(opening|role|position|vacancy|career|immediate|hiring|full-time|part-time)', '', clean)
    return clean.strip()


def extract_potential_role(text: str) -> Optional[str]:
    """Attempts to extract a role string from text."""
    if not text:
        return None
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if not lines:
        return None
    return lines[0][:100]


def detect_and_match_role(
    jd_title: str,
    email_subject: str,
    email_body: str,
    resume_text: str,
    threshold: float = 0.6,
    jd_title_embedding: np.ndarray = None,
) -> Dict:
    """
    Role detection using Zero-Shot Classification (High Accuracy).
    Exact same logic as original system.
    """
    combined_text_parts = []

    clean_subj = ""
    if email_subject:
        clean_subj = re.sub(
            r'(?i)(application|applying|resume|for|regarding|re:|ref:)',
            '',
            email_subject,
        ).strip()
        if clean_subj:
            combined_text_parts.append(clean_subj)

    if email_body:
        body_preview = extract_text_segment(email_body, max_chars=300)
        if body_preview:
            combined_text_parts.append(body_preview)

    if resume_text:
        resume_header = extract_text_segment(resume_text, max_chars=500)
        if resume_header:
            combined_text_parts.append(resume_header)

    combined_text = ". ".join(combined_text_parts)

    if not combined_text:
        logger.warning("No text available for role matching")
        return {
            "detected_role": "Unknown",
            "source": None,
            "is_match": True,
            "similarity": 0.0,
            "jd_title": jd_title,
        }

    core_role = clean_role_name(jd_title)
    labels = [core_role, "Other/Irrelevant Document", "Meeting Minutes (MOM)"]

    try:
        classifier = get_zero_shot_classifier()
        result = classifier(combined_text, candidate_labels=labels, multi_label=False)

        scores_map = dict(zip(result["labels"], result["scores"]))
        relevance_score = scores_map.get(core_role, 0.0)

        logger.info(f"DEBUG: Comparative Scores for '{core_role}': {scores_map}")

        is_top_choice = result["labels"][0] == core_role
        is_match = is_top_choice or (relevance_score >= threshold)

        detected_role_text = clean_subj if email_subject else extract_potential_role(resume_text)
        if not detected_role_text or len(detected_role_text) < 3:
            detected_role_text = core_role

        return {
            "detected_role": detected_role_text,
            "source": "comparative_classification",
            "is_match": is_match,
            "similarity": round(relevance_score, 2),
            "jd_title": core_role,
        }

    except Exception as e:
        logger.error(f"Zero-Shot Classification Error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "detected_role": "Error",
            "source": "error",
            "is_match": True,
            "similarity": 0.0,
            "jd_title": jd_title,
        }


# Legacy compatibility
def get_text_embedding(text: str) -> Optional[np.ndarray]:
    """Deprecated: Kept for backward compatibility."""
    return None


def calculate_semantic_similarity(
    role1_text: str = None,
    role2_text: str = None,
    role1_embedding: np.ndarray = None,
    role2_embedding: np.ndarray = None,
) -> float:
    """Deprecated: Kept for backward compatibility."""
    return 0.0
