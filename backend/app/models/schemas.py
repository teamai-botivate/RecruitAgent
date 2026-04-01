"""
Pydantic Models - All request/response schemas for the Hiring System V2.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from enum import Enum


# ═══════════════════════════════════════════════════════
# Pipeline States
# ═══════════════════════════════════════════════════════

class PipelineState(str, Enum):
    JD_CREATED = "JD_CREATED"
    SCREENING = "SCREENING"
    SCREENING_COMPLETE = "SCREENING_COMPLETE"
    APTITUDE_GENERATED = "APTITUDE_GENERATED"
    TEST_SCHEDULED = "TEST_SCHEDULED"
    TEST_SENT = "TEST_SENT"
    TEST_COMPLETED = "TEST_COMPLETED"
    RESULTS_ANALYSED = "RESULTS_ANALYSED"
    INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED"
    HIRED = "HIRED"
    CLOSED = "CLOSED"


# ═══════════════════════════════════════════════════════
# JD Models
# ═══════════════════════════════════════════════════════

class JDCreateRequest(BaseModel):
    companyName: str
    companyType: str
    industry: str
    location: str
    roleTitle: str
    experience: str
    employmentType: str
    workMode: str
    salary: str


class JDResponse(BaseModel):
    status: str
    jd: str
    jd_id: Optional[str] = None


# ═══════════════════════════════════════════════════════
# Screening Models
# ═══════════════════════════════════════════════════════

class ScreeningStartRequest(BaseModel):
    jd_text: Optional[str] = None
    jd_id: Optional[str] = None
    top_n: int = 5
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class JobStatusResponse(BaseModel):
    job_id: str
    status: str  # "processing", "completed", "error"
    progress: int = Field(ge=0, le=100)
    current_step: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# ═══════════════════════════════════════════════════════
# AI Analysis Models
# ═══════════════════════════════════════════════════════

class CandidateAnalysis(BaseModel):
    filename: str
    candidate_name: str = "Unknown"
    email: Optional[str] = "Not Found"
    phone: Optional[str] = "Not Found"
    years_of_experience: float = 0
    extracted_skills: List[str] = []
    status: str = "Pending"
    achievement_bonus: Optional[int] = 0
    reasoning: str = ""
    strengths: List[str] = []
    weaknesses: List[str] = []
    hobbies_and_achievements: Optional[List[str]] = []


class LLMOutput(BaseModel):
    candidates: List[CandidateAnalysis]


class ExtractedJD(BaseModel):
    job_title: str
    technical_skills: List[str]
    soft_skills: List[str]
    required_years_experience: int
    education_level: str
    responsibilities: List[str]
    summary_for_vector_search: str


# ═══════════════════════════════════════════════════════
# Test / Aptitude Models
# ═══════════════════════════════════════════════════════

class AptitudeGenerateRequest(BaseModel):
    jd_text: str
    difficulty_level: Optional[str] = "Medium"
    custom_instructions: Optional[str] = ""
    mcq_count: Optional[int] = 25
    coding_count: Optional[int] = -1  # -1=auto-detect, 0=skip, >0=exact count


class RunCodeRequest(BaseModel):
    code: str
    language: str
    problem_text: str
    test_cases: list


class CandidateItem(BaseModel):
    email: str
    name: Optional[str] = "Candidate"
    phone: Optional[str] = ""
    resume_path: Optional[str] = ""
    ai_analysis: Optional[dict] = {}


class SendAssessmentRequest(BaseModel):
    jd_id: str
    candidates: List[CandidateItem]
    channel: Optional[str] = "email"  # email | whatsapp | both
    job_title: str
    test_date: Optional[str] = "Immediate"
    duration_minutes: Optional[int] = 60
    mcq_count: int
    coding_count: int
    assessment_link: str
    mcqs: List[dict]
    coding_questions: List[dict]
    company_name: Optional[str] = "RecruitAI"


class SubmitAssessmentRequest(BaseModel):
    token: str
    email: str
    mcq_score: int = 0
    mcq_total: int = 0
    coding_score: int = 0
    coding_total: int = 0
    suspicious: str = "Normal"
    mcq_answers: List[dict] = []
    coding_answers: List[dict] = []
    proctoring_summary: Optional[dict] = None
    proctoring_events: List[dict] = []


class VerifyCandidateRequest(BaseModel):
    token: str
    email: str


# ═══════════════════════════════════════════════════════
# Rejection / Interview Models
# ═══════════════════════════════════════════════════════

class RejectionRequest(BaseModel):
    emails: List[str]
    job_title: str
    company_name: Optional[str] = "RecruitAI"


class ScheduleInterviewRequest(BaseModel):
    emails: List[str]
    job_title: str
    date: str
    time: str
    location: str
    company_name: Optional[str] = "RecruitAI"


# ═══════════════════════════════════════════════════════
# Dashboard Models
# ═══════════════════════════════════════════════════════

class DashboardJD(BaseModel):
    jd_id: str
    title: str
    company: str
    status: str
    created_at: str
    candidate_count: int = 0


# ═══════════════════════════════════════════════════════
# Database Storage Models
# ═══════════════════════════════════════════════════════

class CandidateRecordDB(BaseModel):
    jd_id: str
    name: str
    email: str
    phone: str
    status: str
    score: float
    skills: str
    ai_reasoning: str
    drive_url: str
