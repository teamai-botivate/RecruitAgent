"""
Pydantic Models for Candidates
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class CandidateStatus(str, Enum):
    """Candidate pipeline status"""
    PENDING = "pending"
    SCREENED = "screened"
    SELECTED = "selected"
    REJECTED = "rejected"
    TEST_SENT = "test_sent"
    TEST_COMPLETED = "test_completed"
    SHORTLISTED = "shortlisted"
    INTERVIEW_SCHEDULED = "interview_scheduled"


class ScoreBreakdown(BaseModel):
    """Score breakdown details"""
    total: float = 0.0
    semantic_score: float = 0.0
    semantic_points: float = 0.0
    keyword_score: float = 0.0
    experience_score: float = 0.0
    matched_keywords: List[str] = []
    missing_keywords: List[str] = []
    years: float = 0.0
    is_rejected: bool = False
    rejection_reason: str = ""


class CandidateAnalysis(BaseModel):
    """AI analysis result for a candidate"""
    filename: str
    candidate_name: str = "Not Found"
    email: Optional[str] = "Not Found"
    phone: Optional[str] = "Not Found"
    years_of_experience: float = 0.0
    extracted_skills: List[str] = []
    status: str = "Review Required"
    achievement_bonus: int = 0
    reasoning: str = ""
    strengths: List[str] = []
    weaknesses: List[str] = []
    hobbies_and_achievements: List[str] = []


class Candidate(BaseModel):
    """Full candidate model"""
    id: Optional[str] = None
    jd_id: str
    filename: str
    candidate_name: str = "Not Found"
    email: Optional[str] = None
    phone: Optional[str] = None
    score: ScoreBreakdown = Field(default_factory=ScoreBreakdown)
    status: CandidateStatus = CandidateStatus.PENDING
    
    # From Gmail if applicable
    email_subject: str = ""
    email_body: str = ""
    sender_email: str = ""
    
    # AI Analysis
    ai_analyzed: bool = False
    analysis_method: str = "pending"
    extracted_skills: List[str] = []
    years_of_experience: float = 0.0
    reasoning: Optional[str] = None
    strengths: List[str] = []
    weaknesses: List[str] = []
    achievement_bonus: int = 0
    
    # Role matching
    applied_for: str = ""
    role_match: Dict[str, Any] = {}
    
    # File info
    file_hash: str = ""
    resume_path: Optional[str] = None
    
    # Timestamps
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CandidateListResponse(BaseModel):
    """Response for candidate list"""
    jd_id: str
    total: int
    selected: List[Candidate]
    not_selected: List[Candidate]
    rejected: List[Candidate]


class ScreeningProgress(BaseModel):
    """Progress update during screening"""
    job_id: str
    status: str  # "processing", "completed", "error"
    progress: int  # 0-100
    current_step: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
