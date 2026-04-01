"""
Test API Router - Aptitude test endpoints
"""

import json
import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, Request
from ..models.schemas import (
    AptitudeGenerateRequest, RunCodeRequest, SendAssessmentRequest,
    RejectionRequest, SubmitAssessmentRequest, VerifyCandidateRequest,
)
from ..services.test_service import (
    generate_aptitude_questions, evaluate_code,
    create_assessment, get_assessment, submit_assessment,
    delete_assessment, get_analytics,
)
from ..services.email_service import (
    send_assessment_emails, send_rejection_emails, send_submission_notification,
)
from ..services.whatsapp_service import send_assessment_whatsapp
from ..services.sheets_service import sheets_db
from ..core.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/test", tags=["Aptitude Tests"])
settings = get_settings()


def _normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def _resolve_candidate_identity(token: str, email: str):
    normalized_email = _normalize_email(email)
    if not normalized_email:
        return None

    assessment = get_assessment(token)
    if assessment:
        for candidate in assessment.get("candidates", []):
            candidate_email = _normalize_email(candidate.get("email", ""))
            if candidate_email == normalized_email:
                candidate_meta = dict(candidate)
                candidate_meta["email"] = candidate_email
                return {
                    "email": candidate_email,
                    "candidate_meta": candidate_meta,
                    "assessment": assessment,
                    "jd_id": assessment.get("jd_id", "UNKNOWN"),
                }
        return None

    # Fallback when in-memory assessment is gone after process restart.
    scheduled_rows = sheets_db.get_scheduled_candidates_by_token(token)
    for row in scheduled_rows:
        candidate_email = _normalize_email(row.get("Candidate_Email", "") or row.get("Email", ""))
        if candidate_email == normalized_email:
            return {
                "email": candidate_email,
                "candidate_meta": {
                    "email": candidate_email,
                    "name": row.get("Candidate_Name", "Candidate"),
                },
                "assessment": None,
                "jd_id": row.get("JD_ID", "UNKNOWN") or "UNKNOWN",
            }

    return None


@router.post("/generate")
async def generate_test(request: AptitudeGenerateRequest):
    """Generate aptitude and coding questions from a JD."""
    if not request.jd_text.strip():
        raise HTTPException(status_code=400, detail="Job Description text is empty")

    try:
        result = generate_aptitude_questions(
            request.jd_text,
            request.difficulty_level,
            request.custom_instructions,
            request.mcq_count,
            request.coding_count,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save-test")
async def save_finalized_test(data: dict):
    """Save the HR-reviewed/curated test to GeneratedTests sheet."""
    jd_id = data.get("jd_id", "")
    mcqs = data.get("mcqs", [])
    coding_questions = data.get("coding_questions", [])
    difficulty = data.get("difficulty", "Medium")
    company_name = data.get("company_name", "")

    if not jd_id:
        raise HTTPException(status_code=400, detail="jd_id required")

    test_payload = {"mcqs": mcqs, "coding_questions": coding_questions}

    try:
        sheets_db.save_generated_test(
            jd_id=jd_id,
            test_json=json.dumps(test_payload),
            difficulty=difficulty,
            mcq_count=len(mcqs),
            coding_count=len(coding_questions)
        )
        # Update pipeline state
        sheets_db.update_jd_state(jd_id, "APTITUDE_GENERATED")
        logger.info(f"✅ Saved finalized test for {jd_id}: {len(mcqs)} MCQs, {len(coding_questions)} Coding")
        return {"status": "success", "mcq_count": len(mcqs), "coding_count": len(coding_questions)}
    except Exception as e:
        logger.error(f"Failed to save test: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run-code")
async def run_code(request: RunCodeRequest):
    """Evaluate candidate code submission."""
    try:
        result = evaluate_code(
            request.problem_text,
            request.code,
            request.language,
            request.test_cases,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send")
async def send_test(request: SendAssessmentRequest, background_tasks: BackgroundTasks):
    """Send assessment emails to candidates and store scheduling in Google Sheets."""
    try:
        channel = (request.channel or "email").lower().strip()
        if channel not in {"email", "whatsapp", "both"}:
            raise HTTPException(status_code=400, detail="Invalid channel. Use email, whatsapp, or both")

        # 1. ALWAYS fetch questions from GeneratedTests sheet (single source of truth)
        mcqs = []
        coding = []
        generated = sheets_db.get_generated_test(request.jd_id)
        if generated:
            test_json = json.loads(generated.get("Test_JSON", "{}"))
            mcqs = test_json.get("mcqs", [])
            coding = test_json.get("coding_questions", [])
            logger.info(f"Loaded {len(mcqs)} MCQs, {len(coding)} Coding from GeneratedTests for {request.jd_id}")

        # Fallback to request data if sheets didn't have it
        if not mcqs and request.mcqs:
            mcqs = request.mcqs
        if not coding and request.coding_questions:
            coding = request.coding_questions

        if not mcqs:
            raise HTTPException(status_code=400, detail="No questions found. Generate and save test first.")

        # 2. Get company name from JD
        company_name = request.company_name or "RecruitAI"
        try:
            jd_result = sheets_db.service.spreadsheets().values().get(
                spreadsheetId=sheets_db.spreadsheet_id, range="'JDs'!A:C"
            ).execute()
            for row in jd_result.get('values', [])[1:]:
                if row and row[0] == request.jd_id and len(row) > 2:
                    company_name = row[2]  # Company column
                    break
        except Exception:
            pass

        # 3. Extract token from link
        token = request.assessment_link.split("token=")[-1]
        logger.info(f"Sending test for JD: {request.jd_id}, Token: {token}, Candidates: {len(request.candidates)}")

        # 4. Create assessment in local memory DB with ACTUAL questions
        create_assessment(
            token=token,
            job_title=request.job_title,
            candidates=[c.model_dump() for c in request.candidates],
            mcqs=mcqs,
            coding_questions=coding,
            jd_id=request.jd_id,
            company_name=company_name,
            test_date=request.test_date,
            duration_minutes=request.duration_minutes,
        )

        # 5. Persist to Google Sheets ScheduledTests
        for cand in request.candidates:
            try:
                sheets_db.save_scheduled_test(
                    jd_id=request.jd_id,
                    email=cand.email,
                    name=cand.name,
                    token=token,
                    test_date=request.test_date or "Immediate",
                    duration=request.duration_minutes or 60
                )
                logger.info(f"  ✅ Saved scheduled test for {cand.email}")
            except Exception as e:
                logger.error(f"  ❌ Failed scheduled test save for {cand.email}: {e}")

        # 6. Send notifications by selected channel(s)
        channel_summary = {"email": {"sent": 0, "failed": 0}, "whatsapp": {"sent": 0, "failed": 0}}

        if channel in {"email", "both"}:
            try:
                send_assessment_emails(
                    candidates=[c.model_dump() for c in request.candidates],
                    job_title=request.job_title,
                    mcq_count=len(mcqs),
                    coding_count=len(coding),
                    assessment_link=request.assessment_link,
                    company_name=company_name,
                    test_date=request.test_date,
                    duration_minutes=request.duration_minutes,
                )
                logger.info("  ✅ Assessment emails dispatched.")

                for cand in request.candidates:
                    channel_summary["email"]["sent"] += 1
                    sheets_db.save_message_log(
                        jd_id=request.jd_id,
                        token=token,
                        channel="Email",
                        email=cand.email,
                        phone=cand.phone or "",
                        status="Sent",
                    )
            except Exception as e:
                logger.error(f"  ❌ Email send failed: {e}")
                for cand in request.candidates:
                    channel_summary["email"]["failed"] += 1
                    sheets_db.save_message_log(
                        jd_id=request.jd_id,
                        token=token,
                        channel="Email",
                        email=cand.email,
                        phone=cand.phone or "",
                        status="Failed",
                        error=str(e),
                    )

        if channel in {"whatsapp", "both"}:
            wa_results = send_assessment_whatsapp(
                candidates=[c.model_dump() for c in request.candidates],
                job_title=request.job_title,
                assessment_link=request.assessment_link,
                test_date=request.test_date or "Immediate",
                duration_minutes=request.duration_minutes or 60,
                company_name=request.company_name or "RecruitAI",
            )

            for r in wa_results:
                if r.get("status") in {"Sent", "Accepted"}:
                    channel_summary["whatsapp"]["sent"] += 1
                else:
                    channel_summary["whatsapp"]["failed"] += 1

                sheets_db.save_message_log(
                    jd_id=request.jd_id,
                    token=token,
                    channel="WhatsApp",
                    email=r.get("email", ""),
                    phone=r.get("phone", ""),
                    status=r.get("status", "Failed"),
                    message_id=r.get("message_id", ""),
                    error=r.get("error", ""),
                )

        return {
            "status": "success",
            "token": token,
            "mcq_count": len(mcqs),
            "coding_count": len(coding),
            "channel": channel,
            "dispatch_summary": channel_summary,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SEND TEST ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/get-assessment/{token}")
async def get_test(token: str):
    """Get assessment data by token (for candidate test page)."""
    assessment = get_assessment(token)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found or expired")

    mcqs = assessment.get("mcqs", [])
    coding = assessment.get("coding_questions", [])

    # If questions are empty (server restart), fetch from sheets
    if not mcqs:
        jd_id = assessment.get("jd_id", "")
        if jd_id:
            generated = sheets_db.get_generated_test(jd_id)
            if generated:
                test_json = json.loads(generated.get("Test_JSON", "{}"))
                mcqs = test_json.get("mcqs", [])
                coding = test_json.get("coding_questions", [])
                logger.info(f"Recovered {len(mcqs)} MCQs from sheets for token {token[:8]}...")

    return {
        "mcqs": mcqs,
        "coding": coding,
        "job_title": assessment.get("job_title", "Assessment"),
        "company_name": assessment.get("company_name", ""),
        "test_date": assessment.get("test_date", ""),
        "duration_minutes": assessment.get("duration_minutes", 60),
    }


@router.post("/verify-candidate")
async def verify_candidate(request: VerifyCandidateRequest):
    """Verify candidate email for a test token before starting the test."""
    resolved = _resolve_candidate_identity(request.token, request.email)
    if not resolved:
        raise HTTPException(status_code=403, detail="This email is not authorized for this test link")

    candidate_meta = resolved.get("candidate_meta") or {}
    return {
        "status": "verified",
        "canonical_email": resolved["email"],
        "candidate_name": candidate_meta.get("name") or candidate_meta.get("Name") or "Candidate",
    }


@router.post("/submit")
async def submit_test(data: SubmitAssessmentRequest, background_tasks: BackgroundTasks):
    """Handle candidate test submission."""
    try:
        resolved = _resolve_candidate_identity(data.token, data.email)
        if not resolved:
            raise HTTPException(status_code=403, detail="Submission blocked: email does not match invited candidate")

        canonical_email = resolved["email"]
        c_meta = resolved.get("candidate_meta") or {}
        assessment = resolved.get("assessment")
        jd_id = resolved.get("jd_id", "UNKNOWN") or "UNKNOWN"
        job_title = assessment["job_title"] if assessment else "Unknown Role"

        submission_data = data.model_dump()
        submission_data["email"] = canonical_email
        submit_assessment(submission_data)

        proctoring_summary = data.proctoring_summary or {}
        tab_switches = int(proctoring_summary.get("tab_switches") or 0)
        fullscreen_exits = int(proctoring_summary.get("fullscreen_exits") or 0)
        camera_denied = int(proctoring_summary.get("camera_denied") or 0)
        event_count = int(proctoring_summary.get("event_count") or 0)

        computed_status = data.suspicious or "Normal"
        if tab_switches >= 3 or fullscreen_exits >= 2 or camera_denied > 0:
            computed_status = "Suspicious"

        summary_suffix = (
            f"tab_switches={tab_switches}; fullscreen_exits={fullscreen_exits}; "
            f"camera_denied={camera_denied}; events={event_count}"
        )
        proctoring_status = f"{computed_status} | {summary_suffix}"

        # Persist aggregate score to Sheets with full metadata
        sheets_db.save_assessment_submission(
            token=data.token,
            jd_id=jd_id,
            email=canonical_email,
            mcq_score=data.mcq_score or 0,
            coding_score=data.coding_score or 0,
            total_score=(data.mcq_score or 0) + (data.coding_score or 0),
            status=proctoring_status,
            skills=c_meta.get("Matched_Skills") or c_meta.get("skills") or "",
            reasoning=c_meta.get("AI_Reasoning") or c_meta.get("reasoning") or "",
            drive_url=c_meta.get("Drive_URL") or c_meta.get("drive_url") or ""
        )

        # Persist per-event proctoring audit trail for HR evidence.
        for event in data.proctoring_events or []:
            event_type = str(event.get("event_type") or event.get("type") or "unknown").strip() or "unknown"
            severity = str(event.get("severity") or "info").strip() or "info"
            details = str(event.get("details") or "")
            event_time = str(event.get("event_time") or event.get("time") or "")
            sheets_db.save_proctoring_event(
                token=data.token,
                jd_id=jd_id,
                email=canonical_email,
                event_type=event_type,
                severity=severity,
                details=details,
                event_time=event_time,
            )


        # Persist individual answers
        try:
            for i, ans in enumerate(submission_data.get('mcq_answers', [])):
                sheets_db.save_test_answer(
                    token=data.token, jd_id=jd_id, email=canonical_email,
                    q_no=i+1, q_text=ans.get('question', ''),
                    candidate_ans=ans.get('selected', ''),
                    correct_ans=ans.get('correct', ''),
                    is_correct=ans.get('is_correct', False),
                    q_type='MCQ',
                    explanation=ans.get('explanation', '')
                )

            for i, ans in enumerate(submission_data.get('coding_answers', [])):
                res = ans.get('results', {}) or {}
                feedback = res.get('feedback', '')
                passed = res.get('success', False)
                # Aggregate detailed case-by-case reasoning
                details = "\n".join([f"Case {r.get('test_case', j+1)}: {r.get('reasoning', '')}" for j, r in enumerate(res.get('results', []))])
                full_exp = f"FEEDBACK: {feedback}\n\nDETAILS:\n{details}"
                
                sheets_db.save_test_answer(
                    token=data.token, jd_id=jd_id, email=canonical_email,
                    q_no=i+1, q_text=ans.get('title', ''),
                    candidate_ans=ans.get('code', ''),
                    correct_ans='Logic-verified', is_correct=passed, q_type='Coding',
                    explanation=full_exp
                )

        except Exception:
            pass

        background_tasks.add_task(send_submission_notification, submission_data, job_title)
        return {"status": "success", "email": canonical_email}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-rejection")
async def send_rejection(request: RejectionRequest):
    """Send rejection emails."""
    try:
        send_rejection_emails(request.emails, request.job_title, request.company_name)
        return {"status": "success", "message": f"Sent rejection to {len(request.emails)} candidates"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete-assessment/{token}")
async def delete_test(token: str):
    """Delete an assessment and its submissions."""
    delete_assessment(token)
    return {"status": "success"}


@router.get("/analytics")
async def get_test_analytics():
    """Get all assessments and submissions data."""
    return get_analytics()


@router.get("/answers/{jd_id}/{email}")
async def get_candidate_answers(jd_id: str, email: str):
    """Get submission answers (MCQ & Coding) for a candidate from Google Sheets."""
    from app.services.sheets_service import sheets_db
    answers = sheets_db.get_test_answers(jd_id)
    
    candidate_answers = []
    _email = email.lower().strip()
    
    for row in answers:
        if str(row.get("Email", "")).lower().strip() == _email:
            candidate_answers.append(row)
            
    # Structure them into mcqs and coding arrays
    mcq_answers = []
    coding_answers = []
    
    for ans in candidate_answers:
        q_type = str(ans.get("Type", "MCQ"))
        is_cor = str(ans.get("Is_Correct", "False")).lower() == "true"
        if q_type == "MCQ":
            mcq_answers.append({
                "qNo": ans.get("Question_No"),
                "question": ans.get("Question_Text", ""),
                "candidate": ans.get("Candidate_Answer", ""),
                "correct": ans.get("Correct_Answer", ""),
                "isCorrect": is_cor,
                "type": "MCQ",
                "explanation": ans.get("Explanation", "")
            })

        else:
            coding_answers.append({
                "qNo": ans.get("Question_No"),
                "question": ans.get("Question_Text", ""),
                "candidate": ans.get("Candidate_Answer", ""),
                "correct": "-",
                "isCorrect": is_cor,
                "type": "Coding",
                "explanation": ans.get("Explanation", "")
            })

            
    return {
        "status": "success",
        "mcq_answers": sorted(mcq_answers, key=lambda x: int(x["qNo"]) if str(x["qNo"]).isdigit() else 0),
        "coding_answers": sorted(coding_answers, key=lambda x: int(x["qNo"]) if str(x["qNo"]).isdigit() else 0)
    }


@router.get("/proctoring/{jd_id}/{email}")
async def get_candidate_proctoring(jd_id: str, email: str):
    """Get proctoring event timeline for a candidate from Google Sheets."""
    events = sheets_db.get_proctoring_events(jd_id, email)

    normalized_events = []
    for ev in events:
        normalized_events.append({
            "event_type": ev.get("Event_Type", "unknown"),
            "severity": ev.get("Severity", "info"),
            "details": ev.get("Details", ""),
            "event_time": ev.get("Event_Time", ""),
            "recorded_at": ev.get("Recorded_At", ""),
        })

    severity_rank = {"critical": 3, "high": 2, "medium": 1, "warning": 1, "info": 0}
    highest = "info"
    for ev in normalized_events:
        sev = str(ev.get("severity", "info")).lower()
        if severity_rank.get(sev, 0) > severity_rank.get(highest, 0):
            highest = sev

    return {
        "status": "success",
        "total_events": len(normalized_events),
        "highest_severity": highest,
        "events": normalized_events,
    }


@router.get("/whatsapp/webhook")
async def verify_whatsapp_webhook(
    hub_mode: str = Query(default="", alias="hub.mode"),
    hub_verify_token: str = Query(default="", alias="hub.verify_token"),
    hub_challenge: str = Query(default="", alias="hub.challenge"),
):
    """Meta webhook verification endpoint for WhatsApp delivery callbacks."""
    expected = settings.whatsapp_webhook_verify_token or ""
    if hub_mode == "subscribe" and expected and hub_verify_token == expected:
        return int(hub_challenge) if str(hub_challenge).isdigit() else hub_challenge
    raise HTTPException(status_code=403, detail="Webhook verification failed")


@router.post("/whatsapp/webhook")
async def receive_whatsapp_webhook(request: Request):
    """Receive WhatsApp status callbacks and update MessageLogs entries."""
    payload = await request.json()
    updated = 0
    skipped = 0

    entries = payload.get("entry", []) if isinstance(payload, dict) else []
    for entry in entries:
        for change in entry.get("changes", []) or []:
            value = change.get("value", {}) or {}
            for st in value.get("statuses", []) or []:
                message_id = st.get("id", "")
                raw_status = str(st.get("status", "")).strip().lower()
                normalized = {
                    "sent": "Sent",
                    "delivered": "Delivered",
                    "read": "Read",
                    "failed": "Failed",
                }.get(raw_status, raw_status.title() if raw_status else "Unknown")

                error_text = ""
                errors = st.get("errors") or []
                if errors and isinstance(errors, list):
                    first = errors[0] if isinstance(errors[0], dict) else {}
                    code = first.get("code", "")
                    title = first.get("title", "")
                    detail = first.get("message", "")
                    error_text = " | ".join([x for x in [str(code), title, detail] if x])

                ok = sheets_db.update_message_log_status(
                    message_id=message_id,
                    status=normalized,
                    error=error_text,
                )
                logger.info(
                    "WhatsApp webhook status: msg_id=%s raw=%s normalized=%s updated=%s error=%s",
                    message_id,
                    raw_status,
                    normalized,
                    ok,
                    error_text,
                )
                if ok:
                    updated += 1
                else:
                    skipped += 1

    logger.info(f"WhatsApp webhook processed: updated={updated}, skipped={skipped}")
    return {"status": "ok", "updated": updated, "skipped": skipped}

