"""
Screening API Router - Resume screening endpoints
"""

import os
import shutil
import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Response
from typing import List, Optional

from ..models.schemas import JobStatusResponse
from ..services.screening_service import (
    create_job, get_job, run_screening_pipeline, jobs, update_job_progress
)
from ..services.pdf_service import pdf_service
from ..services.gmail_fetch import gmail_fetch_service
from ..services.drive_service import drive_storage

router = APIRouter(prefix="/screening", tags=["Resume Screening"])

logger = logging.getLogger(__name__)


@router.post("/start")
async def start_screening(
    background_tasks: BackgroundTasks,
    jd_file: UploadFile = File(None),
    jd_text_input: str = Form(None),
    resume_files: List[UploadFile] = File(None),
    start_date: str = Form(None),
    end_date: str = Form(None),
    top_n: int = Form(5),
    jd_id: str = Form(None),
):
    """Start resume screening analysis - exact same flow as original /analyze endpoint."""
    job_id = create_job()

    try:
        temp_dir = f"temp/analysis_{job_id}"
        os.makedirs(temp_dir, exist_ok=True)

        # Handle JD
        jd_text = ""
        jd_source = ""

        if jd_file:
            content = await jd_file.read()
            if jd_file.filename.endswith(".pdf"):
                jd_text, _ = pdf_service.extract_text(content)
            else:
                jd_text = content.decode("utf-8")
            jd_source = jd_file.filename
        elif jd_text_input:
            jd_text = jd_text_input
            jd_source = "Pasted Text"
        else:
            raise HTTPException(status_code=400, detail="JD Required")

        # Handle Resumes
        files_found = False
        gmail_metadata = {}

        # Source A: Manual upload
        if resume_files:
            for file in resume_files:
                file_path = os.path.join(temp_dir, file.filename)
                with open(file_path, "wb") as f:
                    shutil.copyfileobj(file.file, f)
            files_found = True

        # Source B: Gmail (OAuth)
        if start_date and end_date:
            update_job_progress(job_id, 2, "Checking Gmail Connection...")

            if not gmail_fetch_service.is_connected():
                raise HTTPException(
                    status_code=400,
                    detail="Gmail not connected. Please connect your Gmail account first.",
                )

            try:
                update_job_progress(job_id, 3, "Fetching Resumes from Gmail...")
                gmail_resumes = gmail_fetch_service.fetch_resumes(start_date, end_date)

                if gmail_resumes:
                    for item in gmail_resumes:
                        safe_fname = f"[Gmail] {item['filename']}"
                        fpath = os.path.join(temp_dir, safe_fname)

                        gmail_metadata[safe_fname] = {
                            "email_subject": item["email_subject"],
                            "email_body": item["email_body"],
                            "sender_email": item.get("sender", ""),
                        }

                        with open(fpath, "wb") as f:
                            f.write(item["content"])

                    files_found = True

            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to fetch emails: {str(e)}")

        if not files_found:
            raise HTTPException(
                status_code=400,
                detail="No resumes provided. Upload files or select a date range for Gmail.",
            )

        # Spawn background task
        background_tasks.add_task(
            run_screening_pipeline, job_id, jd_text, temp_dir, top_n, jd_source, gmail_metadata, jd_id
        )

        return {"job_id": job_id, "status": "processing"}

    except Exception as e:
        from ..services.screening_service import fail_job
        fail_job(job_id, str(e))
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{job_id}", response_model=JobStatusResponse)
def get_screening_status(job_id: str):
    """Get screening job status and progress."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress=job["progress"],
        current_step=job["current_step"],
        result=job["result"],
        error=job["error"],
    )


@router.post("/upload")
async def upload_resumes(files: List[UploadFile] = File(...)):
    """Upload resumes for later screening."""
    temp_dir = "temp/uploads"
    os.makedirs(temp_dir, exist_ok=True)

    saved = []
    for file in files:
        fpath = os.path.join(temp_dir, file.filename)
        with open(fpath, "wb") as f:
            shutil.copyfileobj(file.file, f)
        saved.append(file.filename)

    return {"status": "success", "files": saved, "count": len(saved)}


@router.get("/drive/proxy/{file_id}")
async def proxy_drive_file(file_id: str):
    """Proxy Drive files to bypass 'You need access' errors in iframes."""
    try:
        content = drive_storage.get_file_bytes(file_id)
        if not content:
            raise HTTPException(status_code=404, detail="File not found or access denied")
        
        return Response(
            content=content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=resume_{file_id}.pdf"
            }
        )
    except Exception as e:
        logger.error(f"PROXY ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

