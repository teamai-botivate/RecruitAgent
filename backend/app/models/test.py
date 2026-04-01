"""
Pydantic Models for Aptitude Tests
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class DifficultyLevel(str, Enum):
    """Test difficulty levels"""
    LOW = "Low"
    MEDIUM = "Medium"
    HARD = "Hard"


class MCQQuestion(BaseModel):
    """Multiple choice question"""
    id: str
    question: str
    options: List[str]
    answer: str


class TestCase(BaseModel):
    """Coding question test case"""
    input: str
    output: str


class CodingQuestion(BaseModel):
    """Coding question model"""
    title: str
    description: str
    constraints: str = ""
    example_input: str = ""
    example_output: str = ""
    test_cases: List[TestCase] = []


class TestGenerateRequest(BaseModel):
    """Request to generate aptitude test"""
    jd_text: str
    difficulty_level: DifficultyLevel = DifficultyLevel.MEDIUM
    custom_instructions: str = ""
    mcq_count: int = Field(default=25, ge=5, le=50)


class TestGenerateResponse(BaseModel):
    """Response with generated test"""
    mcqs: List[MCQQuestion]
    coding_questions: List[CodingQuestion]


class TestCandidateInfo(BaseModel):
    """Candidate info for test"""
    email: str
    name: str = "Candidate"
    resume_path: str = ""
    ai_analysis: Dict[str, Any] = {}


class SendTestRequest(BaseModel):
    """Request to send test to candidates"""
    candidates: List[TestCandidateInfo]
    job_title: str
    mcq_count: int
    coding_count: int
    assessment_link: str
    mcqs: List[Dict[str, Any]]
    coding_questions: List[Dict[str, Any]]
    company_name: str = "RecruitAI"


class TestSubmission(BaseModel):
    """Test submission from candidate"""
    token: str
    email: str
    mcq_answers: Dict[str, str]  # {question_id: selected_answer}
    coding_submissions: List[Dict[str, Any]]  # [{code, language, question_index}]
    time_taken: int  # seconds
    suspicious_activity: str = "Normal"


class TestResult(BaseModel):
    """Test result after evaluation"""
    token: str
    email: str
    mcq_score: int
    mcq_total: int
    coding_score: int
    coding_total: int
    total_percentage: float
    timestamp: float
    suspicious: str = "Normal"


class Assessment(BaseModel):
    """Full assessment record"""
    id: str
    token: str
    job_title: str
    candidates: List[TestCandidateInfo]
    mcqs: List[MCQQuestion]
    coding_questions: List[CodingQuestion]
    timestamp: float
    status: str = "Sent"


class RunCodeRequest(BaseModel):
    """Request to evaluate code"""
    code: str
    language: str
    problem_text: str
    test_cases: List[Dict[str, str]]


class CodeEvaluationResult(BaseModel):
    """Code evaluation result"""
    success: bool
    output: str
    passed_count: int
    total_count: int
