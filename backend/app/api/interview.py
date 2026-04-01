"""
Interview API Router
"""

from fastapi import APIRouter, HTTPException
from ..models.schemas import ScheduleInterviewRequest
from ..services.email_service import send_interview_emails

router = APIRouter(prefix="/interview", tags=["Interview"])


@router.post("/schedule")
async def schedule_interview(request: ScheduleInterviewRequest):
    """Schedule interviews and send email invitations."""
    try:
        send_interview_emails(
            emails=request.emails,
            job_title=request.job_title,
            date=request.date,
            time_str=request.time,
            location=request.location,
            company_name=request.company_name,
        )
        return {"status": "success", "message": "Interview invitations sent successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
