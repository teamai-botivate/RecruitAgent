"""
Resume Screening Service
Contains the EXACT same pipeline logic from Backend/app/main.py (_run_async_analysis)
"""

import os
import re
import json
import uuid
import time
import shutil
import hashlib
import asyncio
import logging
import concurrent.futures
from typing import Dict, List
from datetime import datetime

from .pdf_service import pdf_service
from .vector_service import vector_service
from .ai_service import ai_service
from .score_service import calculate_score
from .jd_extractor import jd_extractor
from .role_matcher import detect_and_match_role, get_text_embedding
from ..models.schemas import LLMOutput
from ..utils.text import clean_text, extract_name
from ..core.config import get_settings
from .sheets_service import sheets_db
from .drive_service import drive_storage

settings = get_settings()
logger = logging.getLogger("ScreeningService")

# ── Job Manager (In-Memory) ─────────────────────────
jobs: Dict[str, Dict] = {}


def normalize_phone_number(phone: str, default_country_code: str = "91") -> str:
    """Normalize phone into a compact international-ish format like 91XXXXXXXXXX."""
    raw = str(phone or "").strip()
    if not raw:
        return ""

    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""

    if len(digits) == 10:
        digits = f"{default_country_code}{digits}"
    elif len(digits) == 11 and digits.startswith("0"):
        digits = f"{default_country_code}{digits[1:]}"

    if len(digits) < 11 or len(digits) > 15:
        return ""
    if len(set(digits[-10:])) == 1:
        return ""

    return digits


def extract_phone_number(text: str) -> str:
    """Extract first valid phone number from resume text."""
    if not text:
        return ""

    patterns = [
        r"(?:\+?91[\s\-]?)?[6-9]\d{9}",
        r"\b0[6-9]\d{9}\b",
        r"(?:\+?\d{1,3}[\s\-]?)?(?:\(?\d{3,5}\)?[\s\-]?){2,4}\d{2,4}",
        r"\+\d{1,3}[\s\-]?\d{7,12}\b",
    ]

    for pattern in patterns:
        matches = re.findall(pattern, text)
        for m in matches:
            normalized = normalize_phone_number(m, settings.whatsapp_country_code)
            if normalized:
                return normalized

    return ""


def update_job_progress(job_id: str, progress: int, step: str):
    """Update job progress and current step."""
    if job_id in jobs:
        final_progress = max(0, min(100, int(progress)))
        jobs[job_id]["progress"] = final_progress
        jobs[job_id]["current_step"] = step
        logger.info(f"[Job {job_id}] {final_progress}% - {step}")


def fail_job(job_id: str, error: str):
    """Mark a job as failed."""
    if job_id in jobs:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = error
        logger.error(f"[Job {job_id}] FAILED: {error}")


def complete_job(job_id: str, result: dict):
    """Mark a job as completed."""
    if job_id in jobs:
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["progress"] = 100
        jobs[job_id]["current_step"] = "Analysis Complete"
        jobs[job_id]["result"] = result
        logger.info(f"[Job {job_id}] COMPLETED Successfully.")


def create_job() -> str:
    """Create a new screening job and return its ID."""
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "processing",
        "progress": 0,
        "current_step": "Uploading Files...",
        "result": None,
        "error": None,
    }
    return job_id


def get_job(job_id: str) -> Dict:
    """Get a job by its ID."""
    return jobs.get(job_id)


async def run_screening_pipeline(
    job_id: str,
    jd_text: str,
    source_dir: str,
    top_n: int,
    jd_source_name: str,
    gmail_metadata: Dict = {},
    jd_id: str = None,
):
    """
    CORE SCREENING PIPELINE
    Exact same logic as original Backend/app/main.py -> _run_async_analysis
    """
    try:
        update_job_progress(job_id, 5, "Initializing Pipeline...")

        # ── 1. PROCESS JOB DESCRIPTION ───────────────
        update_job_progress(job_id, 10, "Extracting Requirements from JD (LLM)...")
        jd_struct = await jd_extractor.extract_structured_jd(jd_text)
        jd_clean = jd_struct.summary_for_vector_search

        jd_data = {
            "title": jd_struct.job_title,
            "text": jd_clean,
            "keywords": jd_struct.technical_skills,
            "required_years": jd_struct.required_years_experience,
            "education": jd_struct.education_level,
        }

        logger.info(f"✅ JD Processed: {jd_data['title']} | Exp: {jd_data['required_years']}y | Skills: {len(jd_data['keywords'])}")

        # ── 2. FILE INGESTION ────────────────────────
        all_files = [f for f in os.listdir(source_dir) if os.path.isfile(os.path.join(source_dir, f))]
        total_files = len(all_files)

        if total_files == 0:
            fail_job(job_id, "No files found to process.")
            return

        resume_texts = {}
        resume_pages = {}
        processed_candidates = []
        file_hashes = {}

        update_job_progress(job_id, 15, f"Parsing {total_files} Resumes (Parallel)...")
        await asyncio.sleep(0.01)

        def process_single_file(fname):
            """Worker function for parallel processing."""
            file_path = os.path.join(source_dir, fname)
            try:
                if fname.lower().endswith(".pdf"):
                    with open(file_path, "rb") as f:
                        file_bytes = f.read()
                        text, pages = pdf_service.extract_text(file_bytes)
                else:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        file_bytes = f.read().encode("utf-8")
                        text = f.read()
                        pages = 1

                file_hash = hashlib.md5(file_bytes).hexdigest()

                # Extract email
                extracted_email = ""
                extracted_phone = ""
                if fname.lower().endswith(".pdf"):
                    try:
                        extracted_email = pdf_service.extract_emails_advanced(file_bytes)
                    except Exception as e:
                        print(f"Advanced Email Extraction Error for {fname}: {e}")

                if not extracted_email:
                    cleaned_for_email = re.sub(
                        r'(?:envelpe|envelope|envel|envlp|phone|linkedinlinkedin|githubgithub|ὑ7)',
                        ' ', text, flags=re.IGNORECASE
                    )
                    email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', cleaned_for_email)
                    if email_match:
                        raw_email = email_match.group(0)
                        at_pos = raw_email.find('@')
                        if at_pos > 0:
                            local_part = raw_email[:at_pos]
                            domain_part = raw_email[at_pos:]
                            if re.search(r'envelpe\s*' + re.escape(raw_email), text, re.IGNORECASE):
                                local_part = local_part[2:]
                                raw_email = local_part + domain_part
                        extracted_email = raw_email

                extracted_phone = extract_phone_number(text)

                clean_txt = clean_text(text)
                score_data = calculate_score(clean_txt, jd_data, semantic_score=0.0, page_count=pages)

                return {
                    "status": "success",
                    "fname": fname,
                    "text": clean_txt,
                    "pages": pages,
                    "hash": file_hash,
                    "score_data": score_data,
                    "email": extracted_email,
                    "phone": extracted_phone,
                }
            except Exception as e:
                return {"status": "error", "fname": fname, "error": str(e)}

        # Run parallel
        processed_filenames = set()
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            future_to_file = {executor.submit(process_single_file, f): f for f in all_files}

            for idx, future in enumerate(concurrent.futures.as_completed(future_to_file)):
                result = future.result()
                fname = result["fname"]

                if result["status"] == "error":
                    logger.error(f"Error reading {fname}: {result['error']}")
                    continue

                text = result["text"]
                pages = result["pages"]
                score_data = result["score_data"]
                file_hashes[fname] = result["hash"]

                resume_texts[fname] = text
                resume_pages[fname] = pages

                parse_prog = 15 + int((idx + 1) / total_files * 25)
                update_job_progress(job_id, parse_prog, f"Parsed {idx+1}/{total_files}: {fname}")

                final_email = result["email"]

                if fname in processed_filenames:
                    continue
                processed_filenames.add(fname)

                if score_data.get("is_rejected"):
                    reason = score_data.get("rejection_reason", "Unknown")
                    logger.warning(f"   ❌ REJECTED: {fname} | Reason: {reason}")
                    processed_candidates.append({
                        "filename": fname,
                        "name": extract_name(text, fname),
                        "score": score_data,
                        "status": "Rejected",
                        "file_hash": result["hash"],
                        "email": final_email,
                        "phone": result.get("phone", ""),
                    })
                else:
                    processed_candidates.append({
                        "filename": fname,
                        "name": extract_name(text, fname),
                        "score": score_data,
                        "text": text,
                        "status": "Pending",
                        "extracted_skills": score_data.get("matched_keywords", []),
                        "years_of_experience": 0.0,
                        "file_hash": result["hash"],
                        "email_subject": gmail_metadata.get(fname, {}).get("email_subject", ""),
                        "email_body": gmail_metadata.get(fname, {}).get("email_body", ""),
                        "email": final_email,
                        "phone": result.get("phone", ""),
                    })

        # ── 3. ROLE FILTERING ────────────────────────
        jobs[job_id]["candidates"] = processed_candidates

        valid_candidates = [c for c in processed_candidates if not c["score"].get("is_rejected", False)]
        rejected_candidates = [c for c in processed_candidates if c["score"].get("is_rejected", False)]

        jd_title = jd_data.get("title", "Unknown Role")
        jd_title_vector = get_text_embedding(jd_title)

        role_matched = []
        role_skipped = []
        role_unclear = []

        for candidate in valid_candidates:
            try:
                match_result = detect_and_match_role(
                    jd_title=jd_title,
                    email_subject=candidate.get("email_subject", ""),
                    email_body=candidate.get("email_body", ""),
                    resume_text=candidate["text"],
                    threshold=0.45,
                    jd_title_embedding=jd_title_vector,
                )
            except Exception as e:
                logger.error(f"Role Match Error for {candidate['filename']}: {e}")
                match_result = {"is_match": True, "detected_role": "Error", "similarity": 0.0}

            candidate["applied_for"] = match_result.get("detected_role") or "Unknown"
            candidate["role_match"] = match_result

            if match_result["is_match"]:
                role_matched.append(candidate)
            elif match_result["detected_role"]:
                role_skipped.append(candidate)
                candidate["score"]["is_rejected"] = True
                candidate["score"]["rejection_reason"] = f"ROLE MISMATCH: Applied for '{match_result['detected_role']}' but JD is for '{jd_title}'"
            else:
                role_unclear.append(candidate)

        vector_candidates = role_matched + role_unclear

        # ── 4. VECTOR ANALYSIS ───────────────────────
        update_job_progress(job_id, 30, "Semantic Analysis (Whole JD vs Resumes)...")

        if vector_candidates:
            try:
                candidate_hashes = [c["file_hash"] for c in vector_candidates]
                existing_hashes = vector_service.check_existing_hashes(candidate_hashes)

                new_docs = []
                new_metas = []
                for c in vector_candidates:
                    if c["file_hash"] not in existing_hashes:
                        new_docs.append(c["text"])
                        new_metas.append({"filename": c["filename"], "file_hash": c["file_hash"]})

                if new_docs:
                    update_job_progress(job_id, 45, f"Embedding {len(new_docs)} new resumes...")
                    vector_service.add_texts(new_docs, new_metas)
                    await asyncio.sleep(0.01)

                candidate_filenames = [c["filename"] for c in vector_candidates]
                if len(candidate_filenames) == 1:
                    search_filter = {"filename": candidate_filenames[0]}
                else:
                    search_filter = {"filename": {"$in": candidate_filenames}}

                results = vector_service.search(jd_clean, k=len(vector_candidates), filter=search_filter)

                sem_map = {}
                for doc, dist in results:
                    sim = max(0.0, 1.0 - (dist / 2))
                    sem_map[doc.metadata["filename"]] = sim

                # Pre-compute skill vectors
                jd_keywords = jd_data.get("keywords", [])
                skill_vectors_cache = {}
                if jd_keywords:
                    try:
                        _vecs = vector_service.embeddings.embed_documents(jd_keywords)
                        skill_vectors_cache = {k: v for k, v in zip(jd_keywords, _vecs)}
                    except Exception as e:
                        logger.error(f"Skill Vector Pre-compute Failed: {e}")

                for c in vector_candidates:
                    fname = c["filename"]
                    final_sem_score = sem_map.get(fname, 0.0)

                    full_text = resume_texts.get(fname, "")
                    try:
                        found_skills, missing_skills = vector_service.check_semantic_skills(
                            full_text, jd_keywords, threshold=0.45,
                            precomputed_skill_vectors=skill_vectors_cache,
                        )
                    except Exception as e:
                        found_skills, missing_skills = [], jd_keywords

                    c["score"]["matched_keywords"] = found_skills
                    c["score"]["missing_keywords"] = missing_skills
                    c["score"]["semantic_score"] = final_sem_score
                    c["score"]["semantic_points"] = round(final_sem_score * 70, 1)

                    exp_score = c["score"].get("experience_score", 0)
                    new_total = c["score"]["semantic_points"] + exp_score
                    c["score"]["total"] = round(min(100, new_total), 1)

                    score_prog = 50 + int((idx + 1) / len(vector_candidates) * 15)
                    update_job_progress(job_id, score_prog, f"Scoring: {fname}")
                    await asyncio.sleep(0.01)

            except Exception as e:
                logger.error(f"Vector Analysis Failed: {str(e)}")
                for c in vector_candidates:
                    c["score"]["total"] = 0

        # ── 5. TOP-K SELECTION ───────────────────────
        vector_candidates.sort(key=lambda x: x["score"]["total"], reverse=True)
        top_candidates = vector_candidates[:top_n]
        remaining = vector_candidates[top_n:]

        update_job_progress(job_id, 70, f"Identified Top {len(top_candidates)} Candidates. Running AI Pass...")
        await asyncio.sleep(0.01)

        # ── 6. AI ANALYSIS ───────────────────────────
        analysis_limit = min(15, top_n + 5)
        if len(vector_candidates) < analysis_limit:
            ai_target = vector_candidates
            not_analyzed = []
        else:
            ai_target = vector_candidates[:analysis_limit]
            not_analyzed = vector_candidates[analysis_limit:]

        for candidate in ai_target:
            candidate["ai_analyzed"] = True
            candidate["analysis_method"] = "full_ai"

        for candidate in not_analyzed:
            candidate["ai_analyzed"] = False
            candidate["analysis_method"] = "similarity_only"
            if "reasoning" not in candidate:
                candidate["reasoning"] = None

        img_analysis = []

        for i in range(len(ai_target)):
            c = ai_target[i]
            source_text = c["text"]
            if len(source_text) > 8000:
                source_text = source_text[:8000] + "\n[...Truncated...]"

            ai_prog = 70 + int((i + 1) / len(ai_target) * 25)
            update_job_progress(job_id, ai_prog, f"AI Analysis: {c['filename']}")

            anon_text = ai_service.anonymize(source_text)

            prompt = f"""
            You are a Senior Technical Recruiter. Analyze this candidate for the Job Description below.

            JD Summary: {jd_clean[:1500]}

            CANDIDATE:
            Filename: {c['filename']}
            Score: {c['score']['total']}
            Content:
            {anon_text}

            INSTRUCTIONS:
            1. Evaluate relevance to the JD.
            2. EXTRACT DETAILS:
               - "years_of_experience": Calculate ONLY from professional work history dates.
               - "extracted_skills": List of technical skills found.
               - "email" and "phone": Extract EXACT text found.
             3. LOOK FOR HIDDEN GEMS: Hackathons, Open Source, Awards.
             4. Assign "achievement_bonus" (0-20 points).
             5. "hobbies_and_achievements": List of hobbies or achievements.
             6. "reasoning": 1-line explanation.

            OUTPUT FORMAT (Strict JSON):
            {{
              "candidates": [
                {{
                  "filename": "{c['filename']}",
                  "candidate_name": "Name",
                  "email": "email@example.com",
                  "phone": "+91...",
                  "years_of_experience": 3.5,
                  "extracted_skills": ["Python", "AWS"],
                  "status": "High Potential",
                  "achievement_bonus": 15,
                  "reasoning": "...",
                  "strengths": ["..."],
                  "weaknesses": ["..."],
                  "hobbies_and_achievements": []
                }}
              ]
            }}
            Ensure the JSON is valid.
            """

            max_retries = 2
            success = False

            for attempt in range(max_retries):
                try:
                    llm_response = ai_service.query(prompt, json_mode=True, temperature=0.0)
                    json_str = llm_response
                    match = re.search(r"```json(.*?)```", llm_response, re.DOTALL)
                    if match:
                        json_str = match.group(1).strip()
                    elif "{" in llm_response:
                        s = llm_response.find("{")
                        e = llm_response.rfind("}")
                        json_str = llm_response[s:e + 1]

                    parsed = LLMOutput.model_validate_json(json_str)

                    if parsed.candidates:
                        parsed.candidates[0].filename = c["filename"]
                        batch_results = [parsed.candidates[0].model_dump()]
                        img_analysis.extend(batch_results)

                    success = True
                    break

                except Exception as e:
                    error_msg = str(e)
                    if "429" in error_msg or "Rate limit" in error_msg:
                        wait = 20 * (attempt + 1)
                        logger.warning(f"   ⚠️ Rate Limit Hit. Retrying in {wait}s...")
                        time.sleep(wait)
                    else:
                        logger.error(f"AI Parse Error ({c['filename']}): {e}")
                        break

            await asyncio.sleep(1.0)

        # ── 7. APPLY AI RESULTS ──────────────────────
        if img_analysis:
            for ai_res in img_analysis:
                target_cand = next((c for c in vector_candidates if c["filename"] == ai_res.get("filename")), None)

                if target_cand:
                    original_email = target_cand.get("email", "")
                    original_phone_raw = str(target_cand.get("phone", "") or "").strip()

                    # Reject placeholders like [PHONE] and preserve only normalized valid values.
                    if original_phone_raw.startswith("[") and original_phone_raw.endswith("]"):
                        original_phone_raw = ""
                    original_phone = normalize_phone_number(original_phone_raw, settings.whatsapp_country_code)

                    new_name = ai_res.get("candidate_name")
                    if new_name and "CANDIDATE" not in new_name.upper() and "NAME" not in new_name.upper() and "[" not in new_name:
                        target_cand["candidate_name"] = new_name

                    ai_phone = normalize_phone_number(ai_res.get("phone", ""), settings.whatsapp_country_code)
                    target_cand["phone"] = original_phone or ai_phone
                    target_cand["extracted_skills"] = ai_res.get("extracted_skills", [])
                    target_cand["status"] = ai_res.get("status", "Review Required")
                    target_cand["reasoning"] = ai_res.get("reasoning", "")
                    target_cand["strengths"] = ai_res.get("strengths", [])
                    target_cand["weaknesses"] = ai_res.get("weaknesses", [])
                    target_cand["hobbies_and_achievements"] = ai_res.get("hobbies_and_achievements", [])

                    bonus = ai_res.get("achievement_bonus", 0)
                    target_cand["achievement_bonus"] = bonus

                    current_total = target_cand["score"]["total"]
                    new_total = min(100, current_total + bonus)
                    target_cand["score"]["total"] = round(new_total, 1)

                    ai_exp = ai_res.get("years_of_experience", 0)
                    ai_skills = ai_res.get("extracted_skills", [])
                    target_cand["score"]["years"] = ai_exp
                    target_cand["score"]["matched_keywords"] = ai_skills
                    req_years = jd_data.get("required_years", 2)
                    new_exp_score = min(30, (ai_exp / req_years) * 30) if req_years else 0
                    target_cand["score"]["experience_score"] = round(new_exp_score, 1)
                    target_cand["score"]["keyword_score"] = len(ai_skills)

                    target_cand["email"] = original_email

        update_job_progress(job_id, 90, "Generating Final Reports...")

        # ── 8. GENERATE REPORTS ──────────────────────
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        report_dir = f"Reports/Campaign_{timestamp}"

        os.makedirs(f"{report_dir}/All_Resumes", exist_ok=True)
        for f in all_files:
            try:
                shutil.copy2(os.path.join(source_dir, f), f"{report_dir}/All_Resumes/{f}")
            except:
                pass

        os.makedirs(f"{report_dir}/Shortlisted_Resumes", exist_ok=True)
        for c in top_candidates:
            try:
                shutil.copy2(os.path.join(source_dir, c["filename"]), f"{report_dir}/Shortlisted_Resumes/{c['filename']}")
            except:
                pass

        os.makedirs(f"{report_dir}/Not_Selected_Resumes", exist_ok=True)
        for c in remaining:
            try:
                shutil.copy2(os.path.join(source_dir, c["filename"]), f"{report_dir}/Not_Selected_Resumes/{c['filename']}")
            except:
                pass

        # ── 9. PREPARE RESULT PAYLOAD ────────────────
        updated_top_candidates = []
        for c in top_candidates:
            is_analyzed = c.get("ai_analyzed", False)
            current_total = c["score"]["total"]
            bonus = c.get("achievement_bonus", 0)
            base_score = max(0, current_total - bonus)

            if is_analyzed:
                status = c.get("status", "Review Required")
                c["score"]["breakdown"] = {
                    "Base Score": round(base_score, 1),
                    "AI Bonus": bonus,
                    "Final Score": current_total,
                    "Status": status,
                }
                c["score"]["breakdown_text"] = f"Base: {base_score:.1f} | Bonus: {bonus:+d} | Final: {current_total:.1f}"
                if not c.get("extracted_skills"):
                    c["extracted_skills"] = c["score"].get("matched_keywords", [])
            else:
                c["score"]["breakdown"] = {"Base Score": current_total, "AI Bonus": 0, "Final": current_total, "Status": "Pending"}
                c["score"]["breakdown_text"] = f"Base: {current_total} (No AI Analysis)"

            updated_top_candidates.append(c)

        updated_top_candidates.sort(key=lambda x: x["score"]["total"], reverse=True)

        for r in remaining:
            if "score" in r and "breakdown" not in r["score"]:
                r["score"]["breakdown"] = {"Base Score": r["score"]["total"], "AI Bonus": 0, "Final": r["score"]["total"]}
                r["score"]["breakdown_text"] = f"Base: {r['score']['total']} (No AI Analysis)"

        final_list = updated_top_candidates + remaining
        final_list.sort(key=lambda x: (x.get("ai_analyzed", False), x["score"]["total"]), reverse=True)

        # ── 10. EXPORT DATA ──────────────────────────
        cutoff = int(top_n)
        true_selected = final_list[:cutoff]
        true_rejected = final_list[cutoff:]

        selected_export = []
        for c in true_selected:
            c["is_selected"] = True
            selected_export.append({
                "name": c.get("candidate_name", c["name"]),
                "email": c.get("email", ""),
                "role": jd_data["title"],
                "resume_path": f"/reports/{os.path.basename(report_dir)}/Shortlisted_Resumes/{c['filename']}",
                "ai_analysis": {
                    "strengths": c.get("strengths", []),
                    "weaknesses": c.get("weaknesses", []),
                    "reasoning": c.get("reasoning", ""),
                    "score": c["score"]["total"],
                    "matched_skills": c.get("extracted_skills", []),
                    "status": c.get("status", "Shortlisted"),
                },
            })

        rejected_export = []
        for c in true_rejected:
            c["status"] = "Not Selected"
            c["is_selected"] = False
            rejected_export.append({
                "name": c.get("candidate_name", c["name"]),
                "email": c.get("email", ""),
                "role": jd_data["title"],
                "reason": "Not Selected (Low Score)",
            })

        with open(f"{report_dir}/selected_candidates.json", "w") as f:
            json.dump(selected_export, f, indent=4)
        with open(f"{report_dir}/not_selected_candidates.json", "w") as f:
            json.dump(rejected_export, f, indent=4)

        # ── 11. PERSIST TO DB & DRIVE ──────────────────────────
        try:
            # 1. Create a Campaign/JD specific folder in Drive
            # Format: JDID_Role_Date
            campaign_folder_name = f"{jd_id or 'JD'}_{jd_data.get('title', 'Role').replace(' ', '_')}_{datetime.now().strftime('%d-%m-%Y')}"
            jd_folder_id = drive_storage.get_or_create_folder(campaign_folder_name)
            
            logger.info(f"Uploading {len(true_selected)} shortlisted resumes to hierarchical Drive folders...")
            
            for c in true_selected:
                fname = c.get("filename", "")
                fpath = os.path.join(source_dir, fname)
                
                if os.path.exists(fpath):
                    cand_name = c.get("candidate_name", c.get("name", "Unknown")).replace(" ", "_")
                    cand_email = c.get("email", "no-email").replace("@", "_at_")
                    
                    # 2. Create Candidate specific subfolder
                    # Format: Name_Email
                    cand_folder_name = f"{cand_name}_{cand_email}"
                    cand_folder_id = drive_storage.get_or_create_folder(cand_folder_name, parent_id=jd_folder_id)
                    
                    # 3. Upload file to that folder
                    safe_name = f"Resume_{fname}"
                    drive_url = drive_storage.upload_file(fpath, safe_name, target_folder_id=cand_folder_id)
                    c["Drive_URL"] = drive_url or ""
                else:
                    c["Drive_URL"] = ""

            # Persist ONLY screened/shortlisted candidates to Google Sheets Database
            sheets_db.save_candidates(jd_id or job_id, true_selected)

            logger.info("✅ Saved ONLY true_selected candidates to Sheets. Rejected candidates will be discarded after email sending.")
        except Exception as e:
            logger.error(f"Error saving to Drive/Sheets: {e}")

        final_rejected = []
        for c in rejected_candidates:
            final_rejected.append({
                "filename": c["filename"],
                "name": c["name"],
                "reason": c["score"].get("rejection_reason"),
                "score": 0,
            })

        result_payload = {
            "status": "success",
            "candidates": final_list,
            "rejected_count": len(final_rejected),
            "rejected_candidates": final_rejected,
            "ai_analysis": img_analysis,
            "report_path": os.path.abspath(report_dir),
            "campaign_folder": os.path.basename(report_dir),
        }

        complete_job(job_id, result_payload)

        # Cleanup temp
        try:
            shutil.rmtree(source_dir)
        except:
            pass

    except Exception as e:
        logger.error(f"FATAL PIPELINE ERROR: {e}")
        import traceback
        traceback.print_exc()
        fail_job(job_id, str(e))
