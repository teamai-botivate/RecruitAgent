"""
Pydantic Models for Job Description
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum


class ExperienceLevel(str, Enum):
    """Experience level options"""
    FRESHER = "Fresher (0-1 Year)"
    JUNIOR = "Junior (1-3 Years)"
    MID = "Mid-Level (3-5 Years)"
    SENIOR = "Senior (5-8 Years)"
    LEAD = "Lead (8+ Years)"


class WorkMode(str, Enum):
    """Work mode options"""
    REMOTE = "Remote"
    HYBRID = "Hybrid"
    ONSITE = "On-site"


class EmploymentType(str, Enum):
    """Employment type options"""
    FULL_TIME = "Full-Time"
    PART_TIME = "Part-Time"
    CONTRACT = "Contract"
    INTERNSHIP = "Internship"


class JDCreateRequest(BaseModel):
    """Request model for JD generation"""
    company_name: str = Field(..., min_length=1, description="Company name")
    company_type: str = Field(default="Technology", description="Type of company")
    industry: str = Field(default="Information Technology", description="Industry sector")
    location: str = Field(default="Remote", description="Job location")
    role_title: str = Field(..., min_length=1, description="Job title/role")
    experience: ExperienceLevel = Field(default=ExperienceLevel.MID, description="Experience level")
    employment_type: EmploymentType = Field(default=EmploymentType.FULL_TIME)
    work_mode: WorkMode = Field(default=WorkMode.REMOTE)
    salary: str = Field(default="Competitive", description="Salary range in LPA")


class ExtractedJD(BaseModel):
    """Structured data extracted from JD"""
    job_title: str
    technical_skills: List[str]
    soft_skills: List[str]
    required_years_experience: int
    education_level: str
    responsibilities: List[str]
    summary_for_vector_search: str


class JDResponse(BaseModel):
    """Response model for generated JD"""
    id: Optional[str] = None
    jd_text: str
    company_name: str
    role_title: str
    created_at: Optional[str] = None
    status: str = "created"


class JDListItem(BaseModel):
    """JD list item for dashboard"""
    id: str
    company_name: str
    role_title: str
    created_at: str
    status: str
    candidates_count: int = 0
