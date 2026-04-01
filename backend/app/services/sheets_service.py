"""
Sheets Service - Database layer using Google Sheets
Persists JD Data, Candidates, and Pipeline States.
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build

from ..core.config import get_settings
from ..models.schemas import CandidateRecordDB

settings = get_settings()
logger = logging.getLogger(__name__)

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

class SheetsDatabaseService:
    def __init__(self):
        self.spreadsheet_id = settings.google_spreadsheet_id
        self.service = None
        self._initialize_service()

    def _initialize_service(self):
        if not self.spreadsheet_id:
            logger.warning("No GOOGLE_SPREADSHEET_ID set. Sheets DB disabled.")
            return

        service_account_path = Path(settings.service_account_file)
        
        if not service_account_path.exists():
            backend_dir = Path(__file__).parent.parent.parent
            options = [
                backend_dir / "service_account.json",
                Path("service_account.json"),
                Path.cwd() / "service_account.json",
                backend_dir.parent / settings.service_account_file
            ]
            for opt in options:
                if opt.exists():
                    service_account_path = opt
                    break

        if not service_account_path.exists():
            logger.error(f"Service account file missing at {service_account_path}")
            return

        try:
            creds = service_account.Credentials.from_service_account_file(
                str(service_account_path), scopes=SCOPES
            )
            self.service = build('sheets', 'v4', credentials=creds)
            logger.info("✅ Connected to Google Sheets Database")
            self._ensure_tables()
        except Exception as e:
            logger.error(f"Failed to connect to Google Sheets: {e}")

    def _ensure_tables(self):
        """Ensure required sheets exist (JDs, Candidates, Tests)."""
        if not self.service:
            logger.warning("Sheets service not initialized. Skipping table check.")
            return

        try:
            logger.info(f"Checking spreadsheet tables in {self.spreadsheet_id}...")
            sheet_metadata = self.service.spreadsheets().get(spreadsheetId=self.spreadsheet_id).execute()
            sheets = [s['properties']['title'] for s in sheet_metadata.get('sheets', [])]
            logger.info(f"Current sheets: {sheets}")

            required_sheets = {
                "JDs": ["JD_ID", "Title", "Company", "State", "JD_Text", "Created_At"],
                "Candidates": ["JD_ID", "Filename", "Name", "Email", "Phone", "Status", "Score", "Matched_Skills", "AI_Reasoning", "Drive_URL"],
                "Assessments": ["Test_Token", "JD_ID", "Candidate_Email", "MCQ_Score", "Coding_Score", "Total_Score", "Proctoring_Status", "Submitted_At", "Matched_Skills", "AI_Reasoning", "Drive_URL"],
                "GeneratedTests": ["JD_ID", "Test_JSON", "Difficulty", "MCQ_Count", "Coding_Count", "Created_At"],
                "ScheduledTests": ["JD_ID", "Candidate_Email", "Candidate_Name", "Token", "Test_Date", "Duration_Min", "Status", "Sent_At", "Matched_Skills", "AI_Reasoning", "Drive_URL"],
                "TestAnswers": ["Token", "JD_ID", "Email", "Question_No", "Question_Text", "Candidate_Answer", "Correct_Answer", "Is_Correct", "Type", "Explanation"],
                "Interviews": ["JD_ID", "Candidate_Email", "Candidate_Name", "Score", "Interview_Date", "Interview_Time", "Location", "Interviewer", "Status", "Matched_Skills", "AI_Reasoning", "Drive_URL"],
                "Joined": ["JD_ID", "Candidate_Email", "Candidate_Name", "Role", "Joining_Date", "Final_Score", "Hired_At", "Matched_Skills", "AI_Reasoning", "Drive_URL"],
                "MessageLogs": ["JD_ID", "Token", "Channel", "Candidate_Email", "Candidate_Phone", "Status", "Message_ID", "Error", "Sent_At"],
                "ProctoringLogs": ["Token", "JD_ID", "Candidate_Email", "Event_Type", "Severity", "Details", "Event_Time", "Recorded_At"],

            }

            requests = []
            sheets_to_create = []
            for sheet_name in required_sheets:
                if sheet_name not in sheets:
                    requests.append({
                        "addSheet": {
                            "properties": {"title": sheet_name}
                        }
                    })
                    sheets_to_create.append(sheet_name)

            if requests:
                logger.info(f"Creating missing sheets: {sheets_to_create}")
                self.service.spreadsheets().batchUpdate(
                    spreadsheetId=self.spreadsheet_id,
                    body={'requests': requests}
                ).execute()
                
                # Re-fetch metadata to ensure sheets are ready
                sheet_metadata = self.service.spreadsheets().get(spreadsheetId=self.spreadsheet_id).execute()
                sheets = [s['properties']['title'] for s in sheet_metadata.get('sheets', [])]
                
            # Write headers for ALL required sheets if they are empty
            for sheet_name, headers in required_sheets.items():
                # Check if sheet has headers
                try:
                    # Use simple range Check
                    check_resp = self.service.spreadsheets().values().get(
                        spreadsheetId=self.spreadsheet_id, 
                        range=f"'{sheet_name}'!A1:A1"
                    ).execute()
                    existing_vals = check_resp.get('values', [])
                    
                    if not existing_vals or not existing_vals[0]:
                        logger.info(f"Initializing headers for {sheet_name}...")
                        self.service.spreadsheets().values().update(
                            spreadsheetId=self.spreadsheet_id,
                            range=f"'{sheet_name}'!A1",
                            valueInputOption="RAW",
                            body={"values": [headers]}
                        ).execute()
                except Exception as e:
                    logger.error(f"Error checking/initializing headers for {sheet_name}: {e}")
                    
        except Exception as e:
            logger.error(f"Error ensuring Google Sheets tables: {e}")

    def _append_row(self, sheet_name: str, row_data: List):
        if not self.service:
            return
        try:
            safe_row = [str(cell) if cell is not None else "" for cell in row_data]
            # Use just sheet name as range for auto-append to first empty row
            self.service.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range=sheet_name,
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": [safe_row]}
            ).execute()
            logger.info(f"✅ Appended row to {sheet_name}")
        except Exception as e:
            logger.error(f"Error appending row to {sheet_name}: {e}")

    def save_jd(self, jd_id: str, title: str, company: str, state: str, text: str):
        """Save a new JD to the JDs sheet."""
        from datetime import datetime
        now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        self._append_row("JDs", [jd_id, title, company, state, text[:5000], now_str])

    def update_jd_state(self, jd_id: str, new_state: str):
        """Update JD state in column D (index 3) of the JDs sheet."""
        if not self.service:
            return
        try:
            # First find the row index
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id, range="'JDs'!A:D"
            ).execute()
            rows = result.get('values', [])
            
            row_idx = -1
            for i, row in enumerate(rows):
                if row and str(row[0]).strip() == str(jd_id).strip():
                    row_idx = i + 1
                    break
            
            if row_idx != -1:
                # Update Column D (index 4 in A-Z)
                self.service.spreadsheets().values().update(
                    spreadsheetId=self.spreadsheet_id,
                    range=f"'JDs'!D{row_idx}",
                    valueInputOption="RAW",
                    body={"values": [[new_state]]}
                ).execute()
                logger.info(f"🔄 Updated JD {jd_id} state to {new_state} in Sheets")
        except Exception as e:
            logger.error(f"Error updating JD state: {e}")

    def save_candidates(self, jd_id: str, candidates: List[Dict]):
        """Save a batch of screened candidates to the DB."""
        if not self.service or not candidates:
            return
        
        values = []
        for c in candidates:
            status = c.get("status", "Pending")
            score = c.get("score", {}).get("total", 0)
            skills = ", ".join(c.get("extracted_skills", []))
            reasoning = c.get("reasoning", "")
            drive_url = c.get("Drive_URL", "")
            
            # Use Pydantic to validate the data locally before sending to DB
            record = CandidateRecordDB(
                jd_id=jd_id,
                name=c.get("candidate_name", c.get("name", "Unknown")),
                email=c.get("email", ""),
                phone=c.get("phone", ""),
                status=status,
                score=float(score),
                skills=skills,
                ai_reasoning=reasoning,
                drive_url=drive_url
            )
            
            # Map Pydantic fields to the EXACT order of columns in the Google Sheet
            values.append([
                record.jd_id,
                c.get("filename", ""), # Filename is extra but kept for reference
                record.name,
                record.email,
                record.phone,
                record.status,
                record.score,
                record.skills,
                record.ai_reasoning,
                record.drive_url
            ])
            
        try:

            self.service.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range="Candidates",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": values}
            ).execute()
            logger.info(f"✅ Appended {len(values)} candidates to DB")
        except Exception as e:
            logger.error(f"Error appending candidates: {e}")

    def save_assessment_submission(self, token: str, jd_id: str, email: str, 
                                   mcq_score: int, coding_score: int, total_score: int, status: str,
                                   skills: str = "", reasoning: str = "", drive_url: str = ""):
        """Save test submission results."""
        self._append_row("Assessments", [
            token, jd_id, email, mcq_score, coding_score, total_score, status, "=NOW()",
            skills, reasoning, drive_url
        ])


    def get_rows_by_jd(self, sheet_name: str, jd_id: str) -> List[Dict]:
        """Generic: fetch all rows from a sheet where JD_ID matches."""
        if not self.service:
            return []
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id, range=f"'{sheet_name}'!A1:Z"
            ).execute()
            rows = result.get('values', [])
            if len(rows) < 2:
                return []
            
            headers = rows[0]
            # Dynamically find which column contains the JD_ID
            jd_col_idx = 0
            for idx, h in enumerate(headers):
                if str(h).strip().upper() == "JD_ID":
                    jd_col_idx = idx
                    break
                    
            data = []
            for row in rows[1:]:
                if row and len(row) > jd_col_idx and str(row[jd_col_idx]).strip() == str(jd_id).strip():
                    entry = {}
                    for i, h in enumerate(headers):
                        val = row[i] if i < len(row) else ""
                        key = str(h).strip()
                        
                        # 🔄 Standardize 'Report_Path' or 'drive_url' to 'Drive_URL' for the Frontend
                        if key.upper() in ["REPORT_PATH", "RESUME_URL", "DRIVE_URL", "DRIVEURL"]:
                            entry["Drive_URL"] = val
                        else:
                            entry[key] = val
                    data.append(entry)
            return data

        except Exception as e:
            logger.error(f"Error fetching rows from {sheet_name}: {e}")
            return []

    def get_candidates_by_jd(self, jd_id: str) -> List[Dict]:
        """Get all candidates for a specific JD."""
        return self.get_rows_by_jd("Candidates", jd_id)

    def save_generated_test(self, jd_id: str, test_json: str, difficulty: str, mcq_count: int, coding_count: int):
        """Save a generated aptitude test."""
        self._append_row("GeneratedTests", [jd_id, test_json, difficulty, mcq_count, coding_count, "=NOW()"])

    def get_generated_test(self, jd_id: str) -> Optional[Dict]:
        """Get the latest generated test for a JD."""
        rows = self.get_rows_by_jd("GeneratedTests", jd_id)
        return rows[-1] if rows else None

    def save_scheduled_test(self, jd_id: str, email: str, name: str, token: str, test_date: str, duration: int,
                            skills: str = "", reasoning: str = "", drive_url: str = ""):
        """Save a scheduled test entry."""
        self._append_row("ScheduledTests", [
            jd_id, email, name, token, test_date, duration, "Sent", "=NOW()",
            skills, reasoning, drive_url
        ])


    def get_scheduled_tests(self, jd_id: str) -> List[Dict]:
        """Get all scheduled tests for a JD."""
        return self.get_rows_by_jd("ScheduledTests", jd_id)

    def get_scheduled_candidates_by_token(self, token: str) -> List[Dict]:
        """Get all scheduled test rows for a specific token."""
        if not self.service:
            return []
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id, range="'ScheduledTests'!A1:Z"
            ).execute()
            rows = result.get('values', [])
            if len(rows) < 2:
                return []

            headers = rows[0]
            token_idx = -1
            for idx, header in enumerate(headers):
                if str(header).strip().upper() == "TOKEN":
                    token_idx = idx
                    break

            if token_idx == -1:
                return []

            target = str(token).strip()
            data = []
            for row in rows[1:]:
                if row and len(row) > token_idx and str(row[token_idx]).strip() == target:
                    entry = {}
                    for i, h in enumerate(headers):
                        entry[str(h).strip()] = row[i] if i < len(row) else ""
                    data.append(entry)
            return data
        except Exception as e:
            logger.error(f"Error fetching ScheduledTests by token: {e}")
            return []

    def save_test_answer(self, token: str, jd_id: str, email: str, q_no: int,
                         q_text: str, candidate_ans: str, correct_ans: str, is_correct: bool, q_type: str, explanation: str = ""):
        """Save a single test answer row."""
        self._append_row("TestAnswers", [token, jd_id, email, q_no, q_text, candidate_ans, correct_ans, str(is_correct), q_type, explanation])


    def get_test_answers(self, jd_id: str) -> List[Dict]:
        """Get all test answers for a JD."""
        return self.get_rows_by_jd("TestAnswers", jd_id)

    def save_interview(self, jd_id: str, email: str, name: str, score: str,
                       date: str, time: str, location: str, interviewer: str,
                       skills: str = "", reasoning: str = "", drive_url: str = ""):
        """Save an interview schedule entry."""
        self._append_row("Interviews", [
            jd_id, email, name, score, date, time, location, interviewer, "Scheduled",
            skills, reasoning, drive_url
        ])


    def get_interviews(self, jd_id: str) -> List[Dict]:
        """Get all interviews for a JD."""
        return self.get_rows_by_jd("Interviews", jd_id)

    def update_interview_status(self, jd_id: str, email: str, new_status: str):
        """Update interview status (Scheduled → Completed → Hired)."""
        if not self.service:
            return
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id, range="'Interviews'!A:I").execute()
            rows = result.get('values', [])
            for i, row in enumerate(rows):
                if row and len(row) >= 2 and row[0] == jd_id and row[1] == email:
                    self.service.spreadsheets().values().update(
                        spreadsheetId=self.spreadsheet_id,
                        range=f"'Interviews'!I{i+1}",
                        valueInputOption="USER_ENTERED",
                        body={"values": [[new_status]]}
                    ).execute()
                    break
        except Exception as e:
            logger.error(f"Error updating interview status: {e}")

    def save_joined(self, jd_id: str, email: str, name: str, role: str, joining_date: str, final_score: str,
                    skills: str = "", reasoning: str = "", drive_url: str = ""):
        """Save a hired/joined candidate."""
        self._append_row("Joined", [
            jd_id, email, name, role, joining_date, final_score, "=NOW()",
            skills, reasoning, drive_url
        ])

    def save_message_log(self, jd_id: str, token: str, channel: str, email: str, phone: str,
                         status: str, message_id: str = "", error: str = ""):
        """Save per-candidate channel dispatch log (Email/WhatsApp)."""
        self._append_row("MessageLogs", [
            jd_id, token, channel, email, phone, status, message_id, error, "=NOW()"
        ])

    def update_message_log_status(self, message_id: str, status: str, error: str = "") -> bool:
        """Update message status in MessageLogs by provider message id."""
        if not self.service or not message_id:
            return False
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range="'MessageLogs'!A1:I",
            ).execute()
            rows = result.get("values", [])
            if len(rows) < 2:
                return False

            headers = rows[0]
            msg_idx = headers.index("Message_ID") if "Message_ID" in headers else 6
            status_idx = headers.index("Status") if "Status" in headers else 5
            error_idx = headers.index("Error") if "Error" in headers else 7

            target = str(message_id).strip()
            for i, row in enumerate(rows[1:], start=2):
                row_msg = str(row[msg_idx]).strip() if len(row) > msg_idx else ""
                if row_msg == target:
                    self.service.spreadsheets().values().update(
                        spreadsheetId=self.spreadsheet_id,
                        range=f"'MessageLogs'!{chr(65 + status_idx)}{i}",
                        valueInputOption="USER_ENTERED",
                        body={"values": [[status]]},
                    ).execute()
                    if error:
                        self.service.spreadsheets().values().update(
                            spreadsheetId=self.spreadsheet_id,
                            range=f"'MessageLogs'!{chr(65 + error_idx)}{i}",
                            valueInputOption="USER_ENTERED",
                            body={"values": [[error]]},
                        ).execute()
                    return True
            return False
        except Exception as e:
            logger.error(f"Error updating MessageLogs status for {message_id}: {e}")
            return False

    def save_proctoring_event(
        self,
        token: str,
        jd_id: str,
        email: str,
        event_type: str,
        severity: str = "info",
        details: str = "",
        event_time: str = "",
    ):
        """Save a single proctoring event for audit and HR review."""
        self._append_row("ProctoringLogs", [
            token,
            jd_id,
            email,
            event_type,
            severity,
            details,
            event_time,
            "=NOW()",
        ])

    def get_proctoring_events(self, jd_id: str, email: str) -> List[Dict]:
        """Fetch proctoring events by JD and candidate email."""
        rows = self.get_rows_by_jd("ProctoringLogs", jd_id)
        target_email = str(email or "").strip().lower()
        events = []
        for row in rows:
            row_email = str(row.get("Candidate_Email", "")).strip().lower()
            if row_email == target_email:
                events.append(row)
        return events


    def get_joined(self, jd_id: str = None) -> List[Dict]:
        """Get joined candidates. If jd_id is None, get all."""
        if jd_id:
            return self.get_rows_by_jd("Joined", jd_id)
        # Get all
        if not self.service:
            return []
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id, range="'Joined'!A1:Z"
            ).execute()
            rows = result.get('values', [])
            if len(rows) < 2:
                return []
            headers = rows[0]
            return [{headers[i]: (row[i] if i < len(row) else "") for i in range(len(headers))} for row in rows[1:]]
        except Exception as e:
            logger.error(f"Error fetching joined: {e}")
            return []

sheets_db = SheetsDatabaseService()
