"""
Shared/Common Pydantic Models
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class EmailRequest(BaseModel):
    """Generic email request"""
    to_email: str
    subject: str
    body: str


class RejectionEmailRequest(BaseModel):
    """Request to send rejection emails"""
    emails: List[str]
    job_title: str
    company_name: str = "RecruitAI"


class InterviewScheduleRequest(BaseModel):
    """Request to schedule interviews"""
    emails: List[str]
    job_title: str
    date: str
    time: str
    location: str
    company_name: str = "RecruitAI"


class GmailStatus(BaseModel):
    """Gmail connection status"""
    connected: bool
    email: Optional[str] = None
    error: Optional[str] = None


class GmailFetchRequest(BaseModel):
    """Request to fetch resumes from Gmail"""
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD


class PipelineState(BaseModel):
    """Pipeline state for LangGraph"""
    jd_id: str
    current_stage: str
    jd_text: Optional[str] = None
    extracted_jd: Optional[Dict[str, Any]] = None
    candidates: List[Dict[str, Any]] = []
    selected_candidates: List[Dict[str, Any]] = []
    test_generated: bool = False
    test_sent: bool = False
    errors: List[str] = []


class APIResponse(BaseModel):
    """Generic API response"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None


class JobStatus(BaseModel):
    """Background job status"""
    job_id: str
    status: str  # "processing", "completed", "error"
    progress: int
    current_step: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
