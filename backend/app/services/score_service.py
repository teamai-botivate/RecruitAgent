"""
Score Service - ATS Score Calculation
Exact same logic as original Backend/app/services/score_service.py
"""

import re
from ..core.config import get_settings
from ..utils.text import extract_years_of_experience, extract_education_level, extract_keywords

settings = get_settings()


def calculate_score(resume_text: str, jd_data: dict, semantic_score: float, page_count: int = 1) -> dict:
    """
    Calculate ATS score for a resume against a JD.
    Uses Semantic (40) + Keywords (30) + Experience (30) formula.
    """
    cand_years = extract_years_of_experience(resume_text)

    breakdown = {
        "is_rejected": False,
        "rejection_reason": "",
        "semantic_score": semantic_score,
        "keyword_score": 0,
        "experience_score": 0,
        "struct_score": 0,
        "total": 0,
        "matched_keywords": [],
        "missing_keywords": [],
        "years": cand_years,
    }

    # ── 1. STRICT REJECTION RULES ────────────────────
    if cand_years < 3:
        if page_count > 1:
            breakdown["is_rejected"] = True
            breakdown["rejection_reason"] = f"REJECTED: Junior (<3y) must be 1 Page. Has {page_count}."
            return breakdown
    else:
        if page_count > 2:
            breakdown["is_rejected"] = True
            breakdown["rejection_reason"] = f"REJECTED: Senior (>=3y) must be Max 2 Pages. Has {page_count}."
            return breakdown

    # ── 2. KEYWORD ANALYSIS (30 Points) ──────────────
    jd_kws = set([k.lower() for k in jd_data.get("keywords", set())])
    resume_lower = resume_text.lower()

    matched = []
    missing = []

    for kw in jd_kws:
        if len(kw.split()) > 1:
            if kw in resume_lower:
                matched.append(kw)
            else:
                missing.append(kw)
        else:
            if re.search(rf'\b{re.escape(kw)}\b', resume_lower):
                matched.append(kw)
            else:
                missing.append(kw)

    # ── 3. EXPERIENCE MATCH (30 Points) ──────────────
    req_years = jd_data.get("required_years", 0)
    if req_years == 0:
        req_years = 2

    exp_ratio = min(1.0, cand_years / req_years)
    score_experience = exp_ratio * 30

    # ── 4. KEYWORD SCORE ─────────────────────────────
    if len(jd_kws) > 0:
        match_ratio = len(matched) / len(jd_kws)
    else:
        match_ratio = 0

    score_keywords = match_ratio * 30

    breakdown["matched_keywords"] = matched
    breakdown["missing_keywords"] = missing

    # ── 5. FINAL TOTAL ───────────────────────────────
    # Semantic (40) + Keywords (30) + Experience (30)
    score_semantic = semantic_score * 40

    total_score = score_semantic + score_keywords + score_experience
    total_score = max(0, min(100, total_score))

    breakdown["total"] = round(total_score, 1)
    breakdown["keyword_score"] = round(score_keywords, 1)
    breakdown["experience_score"] = round(score_experience, 1)
    breakdown["struct_score"] = 0
    breakdown["semantic_points"] = round(score_semantic, 1)
    breakdown["visual_score"] = 0
    breakdown["format_score"] = score_keywords

    return breakdown
