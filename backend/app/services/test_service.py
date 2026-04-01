"""
Test Service - Aptitude Question Generation and Code Evaluation
"""

import os
import json
import uuid
import time
import logging
from typing import Optional
from openai import OpenAI
from ..core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

client = OpenAI(api_key=settings.openai_api_key)

# ── In-memory DB ──
_assessments_db = {"assessments": [], "submissions": []}


def _get_db() -> dict:
    return _assessments_db


def _save_assessment(assessment: dict):
    _assessments_db["assessments"].append(assessment)


def _save_submission(submission: dict):
    _assessments_db["submissions"].append(submission)


def generate_aptitude_questions(
    jd_text: str,
    difficulty_level: str = "Medium",
    custom_instructions: str = "",
    mcq_count: int = 25,
    coding_count: int = -1,
) -> dict:
    """
    Analyzes the JD and generates MCQ + Coding questions.
    coding_count=-1 means auto-detect from JD (tech role = generate, non-tech = skip).
    coding_count=0 means explicitly skip coding questions.
    """

    # Build coding instruction based on coding_count
    if coding_count == 0:
        coding_instruction = "Do NOT generate any coding questions. Set \"coding_questions\" to an empty array []."
    elif coding_count > 0:
        coding_instruction = f"Generate exactly {coding_count} PURE Data Structures and Algorithms (DSA) coding questions at {difficulty_level} difficulty. Do NOT generate framework-specific or API questions."
    else:
        # Auto-detect: let AI decide based on JD
        coding_instruction = (
            "IMPORTANT: Analyze the Job Description carefully.\n"
            "- If the role is technical (Software/IT/Engineering/Data Science/DevOps), generate exactly 4 PURE Data Structures and Algorithms (DSA) coding questions. They MUST be pure algorithmic programming tasks. Do NOT generate framework-specific or API questions.\n"
            "- If the role is NON-technical (HR, Marketing, Sales, Finance, Admin, Management, Content, Design), "
            "set \"coding_questions\" to an empty array []. Do NOT generate coding questions for non-tech roles."
        )

    prompt = f"""
    Create a recruitment assessment JSON based on the provided Job Description.

    DIFFICULTY LEVEL: {difficulty_level}
    TOTAL MCQs REQUIRED: {mcq_count}
    ADDITIONAL RECRUITER INSTRUCTIONS: {custom_instructions if custom_instructions else "None"}

    DIFFICULTY DEFINITIONS:
    - Low: Basic syntax, core concepts, entry-level definitions.
    - Medium: Application-based questions, 2-4 years industry experience level, common edge cases.
    - Hard: Advanced internals, complex logical reasoning, system design patterns, high-level algorithms, 5+ years expert level.

    CODING QUESTIONS:
    {coding_instruction}

    REQUIRED JSON STRUCTURE:
    {{
      "mcqs": [
        {{
          "id": "Q1",
          "question": "text",
          "options": ["A", "B", "C", "D"],
          "answer": "correct option text",
          "explanation": "Brief explanation of why this is correct"
        }}
      ],
      "coding_questions": [
        {{
          "title": "Title of Problem",
          "description": "Clear problem statement and requirements",
          "constraints": "Complexity and input limits",
          "example_input": "sample input",
          "example_output": "sample output",
          "test_cases": [
            {{"input": "in1", "expected_output": "out1"}},
            {{"input": "in2", "expected_output": "out2"}},
            {{"input": "in3", "expected_output": "out3"}}
          ],
          "difficulty": "{difficulty_level}",
          "hints": ["hint 1"]
        }}
      ],
      "role_type": "technical" or "non-technical"
    }}

    RULES:
    1. Generate exactly {mcq_count} MCQs.
    2. STATED DIFFICULTY IS MANDATORY.
    3. Each MCQ must have exactly 4 options.
    4. Each MCQ must include an "explanation" field.
    5. Each coding question must have at least 3 test cases and MUST strictly be a pure Data Structure and Algorithm (DSA) problem.
    6. Include "role_type" field: "technical" or "non-technical".
    7. OUTPUT ONLY THE JSON. NO EXPLANATION.

    JOB DESCRIPTION:
    {jd_text}
    """

    logger.info(f"🚀 Generating assessment: {mcq_count} MCQs, coding_count={coding_count}, difficulty={difficulty_level}")
    try:
        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert technical interviewer and assessment designer. Generate precise, professional questions. Strictly follow difficulty and format requirements.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,
            max_tokens=6000,
            response_format={"type": "json_object"},
        )

        response_content = completion.choices[0].message.content
        data = json.loads(response_content)

        mcqs = data.get("mcqs", [])
        coding = data.get("coding_questions", [])
        role_type = data.get("role_type", "technical")

        logger.info(f"✅ Generated {len(mcqs)} MCQs, {len(coding)} Coding. Role type: {role_type}")
        return {"mcqs": mcqs, "coding_questions": coding, "role_type": role_type}

    except Exception as e:
        logger.error(f"❌ GENERATION ERROR: {e}")
        raise e


def evaluate_code(problem_text: str, user_code: str, language: str, test_cases: list) -> dict:
    """
    Evaluates user code against problem and test cases using AI.
    Returns per-test-case results for professional display.
    """
    prompt = f"""
    You are a code execution simulator. Evaluate the candidate's code submission.

    PROBLEM:
    {problem_text}

    TEST CASES:
    {json.dumps(test_cases, indent=2)}

    CANDIDATE CODE ({language}):
    ```{language}
    {user_code}
    ```

    INSTRUCTIONS:
    1. Mentally trace through the code for each test case.
    2. Determine if each test case passes or fails.
    3. Return JSON with:
       - "success": boolean (true if all pass)
       - "results": array of per-test-case results:
         [{{
           "test_case": 1, 
           "input": "...", 
           "expected": "...", 
           "actual": "...", 
           "passed": true/false,
           "reasoning": "Detailed explanation of why this case passed or failed (e.g. edge case handling, logic error at step X, incorrect return type)"
         }}]
       - "passed_count": number passed
       - "total_count": total test cases
       - "execution_time": "estimated ms"
       - "error": null or error message string
       - "feedback": overall code quality and logical reasoning feedback
    
    OUTPUT ONLY THE JSON.
    """

    try:
        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a precise code execution simulator and evaluator. Be strict and accurate."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        return json.loads(completion.choices[0].message.content)
    except Exception as e:
        logger.error(f"❌ EVALUATION ERROR: {e}")
        return {
            "success": False,
            "results": [],
            "passed_count": 0,
            "total_count": len(test_cases),
            "error": str(e),
            "feedback": "Evaluation failed due to server error."
        }


def create_assessment(
    token: str, job_title: str, candidates: list,
    mcqs: list, coding_questions: list,
    jd_id: str = "UNKNOWN", company_name: str = "",
    test_date: str = "", duration_minutes: int = 60,
):
    """Create and store a new assessment with full metadata."""
    _save_assessment({
        "id": str(uuid.uuid4()),
        "token": token,
        "job_title": job_title,
        "candidates": candidates,
        "emails": [c.get("email", "") for c in candidates],
        "mcqs": mcqs,
        "coding_questions": coding_questions,
        "timestamp": time.time(),
        "status": "Sent",
        "jd_id": jd_id,
        "company_name": company_name,
        "test_date": test_date,
        "duration_minutes": duration_minutes,
    })


def get_assessment(token: str) -> Optional[dict]:
    db = _get_db()
    return next((a for a in db["assessments"] if a["token"] == token), None)


def submit_assessment(data: dict):
    _save_submission({
        "token": data["token"],
        "email": data["email"],
        "mcq_score": data.get("mcq_score", 0),
        "mcq_total": data.get("mcq_total", 0),
        "coding_score": data.get("coding_score", 0),
        "coding_total": data.get("coding_total", 0),
        "timestamp": time.time(),
        "suspicious": data.get("suspicious", "Normal"),
        "mcq_answers": data.get("mcq_answers", []),
        "coding_answers": data.get("coding_answers", []),
    })


def delete_assessment(token: str):
    db = _get_db()
    db["assessments"] = [a for a in db["assessments"] if a["token"] != token]
    db["submissions"] = [s for s in db["submissions"] if s["token"] != token]


def get_analytics() -> dict:
    """Get all assessments and submissions data from Google Sheets for persistence."""
    from .sheets_service import sheets_db

    db = _get_db()

    try:
        if sheets_db.service:
            result = sheets_db.service.spreadsheets().values().get(
                spreadsheetId=sheets_db.spreadsheet_id, range="'Assessments'!A:Z"
            ).execute()
            rows = result.get('values', [])

            if len(rows) > 1:
                headers = rows[0]
                submissions = []
                for r in rows[1:]:
                    if not r: continue
                    entry = {}
                    for i, h in enumerate(headers):
                        entry[h.lower()] = r[i] if i < len(r) else ""

                    formatted = {
                        "token": entry.get("test_token") or entry.get("token"),
                        "email": entry.get("candidate_email") or entry.get("email"),
                        "mcq_score": int(entry.get("mcq_score") or 0),
                        "coding_score": int(entry.get("coding_score") or 0),
                        "total_score": int(entry.get("total_score") or 0),
                        "suspicious": entry.get("proctoring_status") or entry.get("status"),
                        "submitted_at": entry.get("submitted_at") or entry.get("sent_at")
                    }
                    submissions.append(formatted)

                local_tokens = {s["token"] + s["email"] for s in db["submissions"]}
                for s in submissions:
                    key = str(s["token"]) + str(s["email"])
                    if key not in local_tokens:
                        db["submissions"].append(s)

    except Exception as e:
        logger.error(f"Error fetching persistent analytics: {e}")

    return db
