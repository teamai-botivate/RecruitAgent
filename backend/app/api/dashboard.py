"""
Dashboard API Router
"""

from fastapi import APIRouter
from ..graph.pipeline import get_all_pipelines

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/jds")
async def get_dashboard_jds():
    """Get all JDs with pipeline status for dashboard view."""
    pipelines = get_all_pipelines()

    return {
        "status": "success",
        "data": [
            {
                "jd_id": p["jd_id"],
                "title": p["jd_title"],
                "company": p["company_name"],
                "state": p["current_state"],
                "candidate_count": len(p.get("candidates", [])),
                "selected_count": len(p.get("selected_candidates", [])),
                "shortlisted_count": len(p.get("shortlisted", [])),
            }
            for p in pipelines
        ],
    }


@router.get("/pipeline/{jd_id}")
async def get_pipeline_status(jd_id: str):
    """Get detailed pipeline status for a specific JD."""
    from ..graph.pipeline import get_pipeline

    pipeline = get_pipeline(jd_id)
    if not pipeline:
        return {"status": "error", "message": "Pipeline not found"}

    return {"status": "success", "pipeline": pipeline}
