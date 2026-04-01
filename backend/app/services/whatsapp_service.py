"""
WhatsApp Service - Sends assessment notifications using Meta WhatsApp Cloud API.
"""

import logging
import re
import time
from typing import Dict, List

import requests

from ..core.config import get_settings

logger = logging.getLogger("WhatsAppService")
settings = get_settings()


def normalize_phone_number(phone: str, default_country_code: str = "91") -> str:
    """Normalize phone to digits-only international format expected by WhatsApp Cloud API."""
    raw = str(phone or "").strip()
    if not raw:
        return ""

    # Keep only digits and a single leading plus if present.
    has_plus = raw.startswith("+")
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""

    # Normalize common India formats.
    if len(digits) == 10:
        digits = f"{default_country_code}{digits}"
    elif len(digits) == 11 and digits.startswith("0"):
        digits = f"{default_country_code}{digits[1:]}"

    # Guard unrealistic lengths.
    if len(digits) < 11 or len(digits) > 15:
        return ""

    # Avoid obviously invalid numbers like 99999999999.
    if len(set(digits[-10:])) == 1:
        return ""

    return digits if not has_plus else digits


def _build_payload(candidate: Dict, job_title: str, assessment_link: str, test_date: str, duration_minutes: int, company_name: str = "RecruitAI") -> Dict:
    phone = normalize_phone_number(candidate.get("phone", ""), settings.whatsapp_country_code)
    if not phone:
        return {}

    name = candidate.get("name", "Candidate")

    if settings.whatsapp_template_name:
        return {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "template",
            "template": {
                "name": settings.whatsapp_template_name,
                "language": {"code": settings.whatsapp_template_lang},
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": name},
                            {"type": "text", "text": job_title},
                            {"type": "text", "text": test_date or "Immediate"},
                            {"type": "text", "text": str(duration_minutes or 60)},
                            {"type": "text", "text": assessment_link},
                            {"type": "text", "text": company_name},
                        ],
                    }
                ],
            },
        }

    text_body = (
        f"Hello {name},\n\n"
        f"Your assessment for {job_title} is scheduled.\n"
        f"Date: {test_date or 'Immediate'}\n"
        f"Duration: {duration_minutes or 60} minutes\n"
        f"Start Test: {assessment_link}\n\n"
        f"Please complete within the assigned time window."
    )

    return {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "text",
        "text": {"body": text_body},
    }


def send_assessment_whatsapp(
    candidates: List[Dict],
    job_title: str,
    assessment_link: str,
    test_date: str = "Immediate",
    duration_minutes: int = 60,
    company_name: str = "RecruitAI",
) -> List[Dict]:
    """
    Send WhatsApp assessment message to each candidate.
    Returns per-candidate results for logging.
    """
    results: List[Dict] = []

    if not settings.whatsapp_enabled:
        return [
            {
                "email": c.get("email", ""),
                "phone": c.get("phone", ""),
                "status": "Failed",
                "error": "WHATSAPP_ENABLED is false",
                "message_id": "",
            }
            for c in candidates
        ]

    if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
        return [
            {
                "email": c.get("email", ""),
                "phone": c.get("phone", ""),
                "status": "Failed",
                "error": "Missing WhatsApp credentials",
                "message_id": "",
            }
            for c in candidates
        ]

    url = f"https://graph.facebook.com/{settings.whatsapp_api_version}/{settings.whatsapp_phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {settings.whatsapp_access_token}",
        "Content-Type": "application/json",
    }

    gap_seconds = max(0.0, float(getattr(settings, "whatsapp_send_gap_seconds", 0) or 0))

    for idx, candidate in enumerate(candidates):
        payload = _build_payload(candidate, job_title, assessment_link, test_date, duration_minutes, company_name)
        candidate_phone = candidate.get("phone", "")
        candidate_email = candidate.get("email", "")

        if not payload:
            results.append(
                {
                    "email": candidate_email,
                    "phone": candidate_phone,
                    "status": "Failed",
                    "error": "Invalid or missing phone",
                    "message_id": "",
                }
            )
            continue

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=settings.whatsapp_send_timeout)
            body = resp.json() if resp.content else {}

            if resp.status_code in (200, 201):
                msg_id = ""
                if isinstance(body, dict):
                    msgs = body.get("messages", [])
                    if msgs and isinstance(msgs[0], dict):
                        msg_id = msgs[0].get("id", "")

                logger.info(f"✅ WhatsApp accepted by Meta ({idx+1}/{len(candidates)}): {candidate_email} -> {payload.get('to')} | msg_id={msg_id}")
                results.append(
                    {
                        "email": candidate_email,
                        "phone": payload.get("to", candidate_phone),
                        "status": "Accepted",
                        "error": "",
                        "message_id": msg_id,
                    }
                )
            else:
                err = body.get("error", {}) if isinstance(body, dict) else {}
                err_msg = err.get("message", f"HTTP {resp.status_code}") if isinstance(err, dict) else str(body)
                logger.error(f"❌ WhatsApp send failed for {candidate_email}: {err_msg}")
                results.append(
                    {
                        "email": candidate_email,
                        "phone": payload.get("to", candidate_phone),
                        "status": "Failed",
                        "error": err_msg,
                        "message_id": "",
                    }
                )
        except Exception as e:
            logger.error(f"❌ WhatsApp exception for {candidate_email}: {e}")
            results.append(
                {
                    "email": candidate_email,
                    "phone": candidate_phone,
                    "status": "Failed",
                    "error": str(e),
                    "message_id": "",
                }
            )

        # Keep a controlled delay to avoid bulk blast and provider throttling.
        if gap_seconds > 0 and idx < len(candidates) - 1:
            time.sleep(gap_seconds)

    return results
