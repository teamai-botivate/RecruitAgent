"""
LangGraph Pipeline - State Machine for Hiring Flow
JD_CREATED → SCREENING → SELECTED → TEST_SENT → TEST_COMPLETED → SHORTLISTED → INTERVIEW_SCHEDULED
"""

import logging
from typing import TypedDict, Optional, List, Dict, Any
from ..models.schemas import PipelineState

logger = logging.getLogger(__name__)


class HiringPipelineState(TypedDict):
    """State object for the hiring pipeline."""
    jd_id: str
    jd_text: str
    jd_title: str
    company_name: str
    current_state: str
    candidates: List[Dict[str, Any]]
    selected_candidates: List[Dict[str, Any]]
    test_token: Optional[str]
    test_results: List[Dict[str, Any]]
    shortlisted: List[Dict[str, Any]]
    interview_details: Optional[Dict[str, Any]]
    created_at: str
    error: Optional[str]


# ── In-memory pipeline store ─────────────────────────
_pipelines: Dict[str, HiringPipelineState] = {}


def sync_all_from_sheets():
    """Initial sync of _pipelines from Google Sheets storage."""
    from ..services.sheets_service import sheets_db
    logger.info("🔄 Syncing memory pipelines with Google Sheets...")
    
    try:
        # Fetch all JDs
        jd_result = sheets_db.service.spreadsheets().values().get(
            spreadsheetId=sheets_db.spreadsheet_id, range="'JDs'!A:Z"
        ).execute()
        jd_rows = jd_result.get('values', [])
        
        if len(jd_rows) < 2:
            logger.info("No JDs found in sheets to sync.")
            return

        # Fetch all candidates once for mapping
        cand_result = sheets_db.service.spreadsheets().values().get(
            spreadsheetId=sheets_db.spreadsheet_id, range="'Candidates'!A:Z"
        ).execute()
        cand_rows = cand_result.get('values', [])
        
        # Build candidate map
        cand_map = {}
        if len(cand_rows) > 1:
            headers = cand_rows[0]
            for r in cand_rows[1:]:
                if not r: continue
                jid = str(r[0]).strip()
                if jid not in cand_map: cand_map[jid] = []
                
                # Turn row into dict based on headers
                c_dict = {headers[i]: r[i] if i < len(r) else "" for i in range(len(headers))}
                # Remap key names for frontend pipeline consistency if needed
                c_dict["name"] = c_dict.get("Name", "Unknown")
                c_dict["email"] = c_dict.get("Email", "")
                c_dict["status"] = c_dict.get("Status", "Pending")
                cand_map[jid].append(c_dict)

        # Populate memory store
        for row in jd_rows[1:]:
            if not row: continue
            jid = row[0]
            _pipelines[jid] = HiringPipelineState(
                jd_id=jid,
                jd_title=row[1] if len(row) > 1 else "",
                company_name=row[2] if len(row) > 2 else "RecruitAI",
                current_state=row[3] if len(row) > 3 else "JD_CREATED",
                jd_text=row[4] if len(row) > 4 else "",
                candidates=cand_map.get(jid, []),
                selected_candidates=[c for c in cand_map.get(jid, []) if str(c.get("Status")).lower() == "shortlisted"],
                test_token=None,
                test_results=[],
                shortlisted=[],
                interview_details=None,
                created_at=row[5] if len(row) > 5 else "",
                error=None
            )
        logger.info(f"✅ Synced {len(_pipelines)} pipelines from database.")
    except Exception as e:
        logger.error(f"Failed to sync pipelines from sheets: {e}")


def create_pipeline(jd_id: str, jd_text: str, jd_title: str, company_name: str, created_at: Optional[str] = None) -> HiringPipelineState:
    """Create a new hiring pipeline for a JD."""
    from datetime import datetime
    _now = created_at or datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    state = HiringPipelineState(
        jd_id=jd_id,
        jd_text=jd_text,
        jd_title=jd_title,
        company_name=company_name,
        current_state=PipelineState.JD_CREATED,
        candidates=[],
        selected_candidates=[],
        test_token=None,
        test_results=[],
        shortlisted=[],
        interview_details=None,
        created_at=_now,
        error=None,
    )
    _pipelines[jd_id] = state
    logger.info(f"📋 Pipeline created for JD: {jd_id} ({jd_title})")
    return state


def get_pipeline(jd_id: str) -> Optional[HiringPipelineState]:
    """Get pipeline state for a JD."""
    return _pipelines.get(jd_id)


def get_all_pipelines() -> List[HiringPipelineState]:
    """Get all pipeline states."""
    return list(_pipelines.values())


def transition_to(jd_id: str, new_state: PipelineState, **kwargs) -> Optional[HiringPipelineState]:
    """
    Transition a pipeline to a new state.
    Valid transitions:
    JD_CREATED → SCREENING → SELECTED → TEST_SENT → TEST_COMPLETED → SHORTLISTED → INTERVIEW_SCHEDULED
    """
    pipeline = _pipelines.get(jd_id)
    if not pipeline:
        logger.error(f"Pipeline not found for JD: {jd_id}")
        return None

    valid_transitions = {
        PipelineState.JD_CREATED: [PipelineState.SCREENING],
        PipelineState.SCREENING: [PipelineState.SCREENING_COMPLETE],
        PipelineState.SCREENING_COMPLETE: [PipelineState.APTITUDE_GENERATED],
        PipelineState.APTITUDE_GENERATED: [PipelineState.TEST_SCHEDULED],
        PipelineState.TEST_SCHEDULED: [PipelineState.TEST_SENT],
        PipelineState.TEST_SENT: [PipelineState.TEST_COMPLETED],
        PipelineState.TEST_COMPLETED: [PipelineState.RESULTS_ANALYSED],
        PipelineState.RESULTS_ANALYSED: [PipelineState.INTERVIEW_SCHEDULED],
        PipelineState.INTERVIEW_SCHEDULED: [PipelineState.HIRED],
    }

    current = pipeline["current_state"]
    allowed = valid_transitions.get(current, [])

    if new_state not in allowed:
        logger.warning(f"Invalid transition: {current} → {new_state} for JD {jd_id}")
        # Allow the transition anyway for flexibility
        logger.info(f"Forcing transition: {current} → {new_state}")

    pipeline["current_state"] = new_state

    # Update additional fields
    for key, value in kwargs.items():
        if key in pipeline:
            pipeline[key] = value

    _pipelines[jd_id] = pipeline
    logger.info(f"🔄 Pipeline {jd_id}: {current} → {new_state}")
    return pipeline


def update_candidates(jd_id: str, candidates: list):
    """Update candidates list for a pipeline."""
    if jd_id in _pipelines:
        _pipelines[jd_id]["candidates"] = candidates


def update_selected(jd_id: str, selected: list):
    """Update selected candidates for a pipeline."""
    if jd_id in _pipelines:
        _pipelines[jd_id]["selected_candidates"] = selected


def update_test_token(jd_id: str, token: str):
    """Update test token for a pipeline."""
    if jd_id in _pipelines:
        _pipelines[jd_id]["test_token"] = token


def update_shortlisted(jd_id: str, shortlisted: list):
    """Update shortlisted candidates."""
    if jd_id in _pipelines:
        _pipelines[jd_id]["shortlisted"] = shortlisted
