"""
JD API Router - Job Description endpoints
"""

from fastapi import APIRouter, HTTPException
from ..models.schemas import JDCreateRequest, JDResponse, PipelineState
from ..services.jd_service import generate_jd, generate_jd_id
from ..graph.pipeline import create_pipeline, get_all_pipelines
from ..services.sheets_service import sheets_db

router = APIRouter(prefix="/jd", tags=["Job Descriptions"])

@router.post("/create", response_model=JDResponse)
async def create_jd(request: JDCreateRequest):
    """Generate a professional JD using AI."""
    try:
        jd_text = await generate_jd(request.model_dump())
        jd_id = generate_jd_id()

        # Create pipeline for this JD
        create_pipeline(
            jd_id=jd_id,
            jd_text=jd_text,
            jd_title=request.roleTitle,
            company_name=request.companyName,
        )

        # Persist to Google Sheets Database
        sheets_db.save_jd(
            jd_id=jd_id,
            title=request.roleTitle,
            company=request.companyName,
            state="JD_CREATED",
            text=jd_text
        )

        return JDResponse(status="success", jd=jd_text, jd_id=jd_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all")
async def get_all_jds():
    """Get all JDs with their pipeline status."""
    pipelines = get_all_pipelines()
    jd_list = [
        {
            "jd_id": p["jd_id"],
            "title": p["jd_title"],
            "company": p["company_name"],
            "status": p["current_state"],
            "state": p["current_state"],
            "candidate_count": len(p.get("candidates", [])),
            "selected_count": len([c for c in p.get("candidates", []) if c.get("status", "").strip().lower() == "shortlisted"]),
            "shortlisted_count": len([c for c in p.get("candidates", []) if "interview" in c.get("status", "").strip().lower()]),
            "created_at": p.get("created_at", ""),
        }
        for p in pipelines
    ]
    
    # Fallback: also load from Google Sheets for persisted JDs not in memory
    try:
        if sheets_db.service:
            jd_result = sheets_db.service.spreadsheets().values().get(
                spreadsheetId=sheets_db.spreadsheet_id, range="'JDs'!A:F"
            ).execute()
            jd_rows = jd_result.get('values', [])
            
            # Fetch candidates once to compute stats efficiently
            cand_result = sheets_db.service.spreadsheets().values().get(
                spreadsheetId=sheets_db.spreadsheet_id, range="'Candidates'!A:Z"
            ).execute()
            cand_rows = cand_result.get('values', [])
            
            # Group candidate stats by JD_ID
            jd_stats = {}
            if len(cand_rows) > 1:
                headers = cand_rows[0]
                status_idx = headers.index("Status") if "Status" in headers else 5
                
                for r in cand_rows[1:]:
                    if not r: continue
                    jid = str(r[0]).strip()
                    status = r[status_idx] if len(r) > status_idx else ""
                    clean_status = str(status).strip().lower()
                    
                    if jid not in jd_stats:
                        jd_stats[jid] = {"total": 0, "shortlisted": 0, "interviews": 0}
                    
                    jd_stats[jid]["total"] += 1
                    if clean_status == "shortlisted":
                        jd_stats[jid]["shortlisted"] += 1
                    if "interview" in clean_status:
                        jd_stats[jid]["interviews"] += 1
            
            existing_ids = {j["jd_id"] for j in jd_list}
            
            # Sync memory JDs with real DB counts
            for j in jd_list:
                jid = str(j["jd_id"]).strip()
                if jid in jd_stats:
                    j["candidate_count"] = jd_stats[jid]["total"]
                    j["selected_count"] = jd_stats[jid]["shortlisted"]
                    j["shortlisted_count"] = jd_stats[jid]["interviews"]
                    
            for row in jd_rows[1:]:
                if row and row[0] not in existing_ids:
                    jid = str(row[0]).strip()
                    stats = jd_stats.get(jid, {"total": 0, "shortlisted": 0, "interviews": 0})
                    jd_list.append({
                        "jd_id": jid,
                        "title": row[1] if len(row) > 1 else "",
                        "company": row[2] if len(row) > 2 else "",
                        "status": row[3] if len(row) > 3 else "UNKNOWN",
                        "state": row[3] if len(row) > 3 else "UNKNOWN",
                        "candidate_count": stats["total"],
                        "selected_count": stats["shortlisted"],
                        "shortlisted_count": stats["interviews"],
                        "created_at": row[5] if len(row) > 5 else "",
                    })
    except Exception:
        pass
    
    return {"status": "success", "jds": jd_list}

@router.post("/update_state")
async def update_jd_state(jd_id: str, new_state: str):
    """Update pipeline state for a JD."""
    from ..graph.pipeline import transition_to
    
    # Update in-memory if it exists
    pipeline = transition_to(jd_id, new_state)
    
    try:
        # ALWAYS force update the persistent sheet database
        sheets_db.update_jd_state(jd_id, new_state)
        return {"status": "success", "jd_id": jd_id, "new_state": new_state}
    except Exception as e:
        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found in memory, and DB update failed.")
        return {"status": "success", "jd_id": jd_id, "new_state": new_state, "warning": str(e)}


@router.post("/{jd_id}/candidates/shortlist")
async def shortlist_candidates(jd_id: str, payload: dict):
    """Mark specific candidate emails as Shortlisted in Google Sheets."""
    emails = payload.get("emails", [])
    if not emails:
        return {"status": "success", "message": "No candidates to shortlist"}
        
    try:
        if not sheets_db.service:
            raise Exception("Sheets service unavailable")
            
        # Get all rows in Candidates sheet
        result = sheets_db.service.spreadsheets().values().get(
            spreadsheetId=sheets_db.spreadsheet_id, range="'Candidates'!A:Z"
        ).execute()
        rows = result.get('values', [])
        
        if not rows:
            return {"status": "error", "message": "No data found"}
            
        # Find headers
        headers = rows[0]
        try:
            email_idx = headers.index("Email")
            jd_idx = headers.index("JD_ID")
            status_idx = headers.index("Status")
        except ValueError:
            raise Exception("Required columns are missing in Candidates sheet")
            
        update_requests = []
        for i, row in enumerate(rows):
            if i == 0: continue
            if len(row) > max(email_idx, jd_idx) and row[jd_idx] == jd_id and row[email_idx] in emails:
                # Update status column for this row
                # Status is at status_idx, column letter is chr(ord('A') + status_idx)
                # But more simply, using the standard update
                col_letter = chr(ord('A') + status_idx)
                update_requests.append({
                    "range": f"'Candidates'!{col_letter}{i+1}",
                    "values": [["Shortlisted"]]
                })
        
        # Batch update
        for u in update_requests:
            sheets_db.service.spreadsheets().values().update(
                spreadsheetId=sheets_db.spreadsheet_id,
                range=u["range"],
                valueInputOption="USER_ENTERED",
                body={"values": u["values"]}
            ).execute()
            
        # Update in-memory pipeline candidates iteratively as well
        from ..graph.pipeline import get_pipeline
        pipeline = get_pipeline(jd_id)
        if pipeline and "candidates" in pipeline:
            for c in pipeline["candidates"]:
                if c.get("email") in emails:
                    c["status"] = "Shortlisted"
                    
        return {"status": "success", "updated": len(update_requests)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to shortlist candidates: {str(e)}")


@router.get("/joined/all")
async def get_all_joined():
    """Get all joined candidates across all JDs."""
    joined = sheets_db.get_joined()
    return {"status": "success", "joined": joined, "count": len(joined)}


@router.get("/{jd_id}/candidates")
async def get_jd_candidates(jd_id: str, status: str = None):
    """Get all candidates for a specific JD, optionally filtered by status."""
    candidates = sheets_db.get_candidates_by_jd(jd_id)
    if status:
        candidates = [c for c in candidates if str(c.get("Status", "")).strip().lower() == str(status).strip().lower()]
    return {"status": "success", "jd_id": jd_id, "candidates": candidates, "count": len(candidates)}


@router.get("/{jd_id}/detail")
async def get_jd_detail(jd_id: str):
    """Get full JD detail including text, candidates, test data, interviews, joined."""
    # Get JD text from sheets
    if not sheets_db.service:
        return {"status": "error", "detail": "Sheets not connected"}
    try:
        result = sheets_db.service.spreadsheets().values().get(
            spreadsheetId=sheets_db.spreadsheet_id, range="'JDs'!A:F"
        ).execute()
        rows = result.get('values', [])
        jd_data = None
        for row in rows[1:]:
            if row and row[0] == jd_id:
                jd_data = {
                    "jd_id": row[0],
                    "title": row[1] if len(row) > 1 else "",
                    "company": row[2] if len(row) > 2 else "",
                    "state": row[3] if len(row) > 3 else "",
                    "jd_text": row[4] if len(row) > 4 else "",
                    "created_at": row[5] if len(row) > 5 else ""
                }
                break
        if not jd_data:
            raise HTTPException(status_code=404, detail="JD not found")

        candidates = sheets_db.get_candidates_by_jd(jd_id)
        generated_test = sheets_db.get_generated_test(jd_id)
        scheduled_tests = sheets_db.get_scheduled_tests(jd_id)
        interviews = sheets_db.get_interviews(jd_id)
        joined = sheets_db.get_joined(jd_id)

        return {
            "status": "success",
            "jd": jd_data,
            "candidates": candidates,
            "generated_test": generated_test,
            "scheduled_tests": scheduled_tests,
            "interviews": interviews,
            "joined": joined
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{jd_id}/schedule_interview")
async def schedule_jd_interview(jd_id: str, data: dict):
    """Schedule interviews for selected candidates of a JD."""
    from ..services.email_service import send_interview_emails
    
    candidates = data.get("candidates", [])
    date = data.get("date", "")
    time_str = data.get("time", "")
    location = data.get("location", "")
    interviewer = data.get("interviewer", "")
    job_title = data.get("job_title", "")
    company_name = data.get("company_name", "")
    
    # Auto-fetch company name from JDs sheet if not provided
    if not company_name:
        try:
            result = sheets_db.service.spreadsheets().values().get(
                spreadsheetId=sheets_db.spreadsheet_id, range="'JDs'!A:C"
            ).execute()
            for row in result.get('values', [])[1:]:
                if row and row[0] == jd_id and len(row) > 2:
                    company_name = row[2]
                    break
        except Exception:
            pass
    company_name = company_name or "RecruitAI"
    
    emails = []
    for c in candidates:
        sheets_db.save_interview(
            jd_id=jd_id, email=c["email"], name=c["name"],
            score=str(c.get("score", "")), date=date, time=time_str,
            location=location, interviewer=interviewer,
            skills=c.get("Matched_Skills") or c.get("skills") or "",
            reasoning=c.get("AI_Reasoning") or c.get("reasoning") or "",
            drive_url=c.get("Drive_URL") or c.get("drive_url") or ""
        )
        emails.append(c["email"])

    
    try:
        send_interview_emails(emails=emails, job_title=job_title, date=date,
                              time_str=time_str, location=location, company_name=company_name)
    except Exception as e:
        pass
    
    from ..graph.pipeline import transition_to, PipelineState
    transition_to(jd_id, PipelineState.INTERVIEW_SCHEDULED)
    sheets_db.update_jd_state(jd_id, "INTERVIEW_SCHEDULED")
    
    return {"status": "success", "scheduled": len(candidates)}


@router.post("/{jd_id}/confirm_hired")
async def confirm_hired(jd_id: str, data: dict):
    """Mark selected candidates as hired/joined."""
    candidates = data.get("candidates", [])
    role = data.get("role", "")
    
    for c in candidates:
        sheets_db.save_joined(
            jd_id=jd_id, email=c["email"], name=c["name"],
            role=role, joining_date=c.get("joining_date", ""),
            final_score=str(c.get("score", "")),
            skills=c.get("Matched_Skills") or c.get("skills") or "",
            reasoning=c.get("AI_Reasoning") or c.get("reasoning") or "",
            drive_url=c.get("Drive_URL") or c.get("drive_url") or ""
        )

    
    from ..graph.pipeline import transition_to, PipelineState
    transition_to(jd_id, PipelineState.HIRED)
    sheets_db.update_jd_state(jd_id, "HIRED")
    return {"status": "success", "hired": len(candidates)}


@router.post("/{jd_id}/close_campaign")
async def close_campaign(jd_id: str):
    """Mark a recruitment campaign as closed (no hire)."""
    from ..graph.pipeline import transition_to, PipelineState
    transition_to(jd_id, PipelineState.CLOSED)
    sheets_db.update_jd_state(jd_id, "CLOSED")
    return {"status": "success", "message": "Campaign closed successfully."}


