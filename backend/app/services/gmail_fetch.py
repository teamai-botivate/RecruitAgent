"""
Gmail Fetch Service - Fetches resume attachments from Gmail
Exact same logic as original Backend/app/services/gmail_fetch_service.py
"""

import re
import base64
import email
import logging
from datetime import datetime, timedelta
from typing import List, Dict

from googleapiclient.discovery import build
from .gmail_oauth import gmail_oauth_service

logger = logging.getLogger("GmailFetchService")


class GmailFetchService:
    """Fetches resumes from Gmail using OAuth 2.0 authentication."""

    COMPANY_ID = "default_company"

    def is_connected(self) -> bool:
        """Check if Gmail is connected."""
        return gmail_oauth_service.is_connected(self.COMPANY_ID)

    def fetch_resumes(self, start_date: str, end_date: str) -> List[Dict]:
        """
        Fetch resume attachments from Gmail.
        Returns list of dicts with: filename, content, email_subject, email_body, sender
        """
        if not self.is_connected():
            raise ValueError("Gmail not connected. Please connect your Gmail account first.")

        try:
            service = gmail_oauth_service.get_gmail_service(self.COMPANY_ID)

            # Increment end_date by 1 day (Gmail 'before:' is exclusive)
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                end_dt_inc = end_dt + timedelta(days=1)
                effective_end_date = end_dt_inc.strftime("%Y-%m-%d")
            except ValueError:
                effective_end_date = end_date

            query = f'has:attachment filename:pdf (resume OR cv OR hiring OR job OR application) after:{start_date} before:{effective_end_date}'
            logger.info(f"Searching Gmail with query: {query}")

            results = service.users().messages().list(
                userId="me", q=query, maxResults=100
            ).execute()

            messages = results.get("messages", [])
            logger.info(f"Found {len(messages)} emails with attachments")

            if not messages:
                return []

            resumes = []
            seen_filenames = set()

            for msg_info in messages:
                try:
                    msg_id = msg_info["id"]

                    message = service.users().messages().get(
                        userId="me", id=msg_id, format="full"
                    ).execute()

                    headers = message["payload"].get("headers", [])
                    subject = next(
                        (h["value"] for h in headers if h["name"].lower() == "subject"),
                        "No Subject",
                    )

                    sender_header = next(
                        (h["value"] for h in headers if h["name"].lower() == "from"),
                        "",
                    )
                    sender_match = re.search(r'<(.+?)>', sender_header)
                    sender_email = sender_match.group(1) if sender_match else sender_header
                    if "@" not in sender_email:
                        sender_email = ""
                    else:
                        sender_email = sender_email.strip()

                    body = self._extract_body(message["payload"])

                    all_parts = self._get_all_parts(message["payload"].get("parts", []))

                    for part in all_parts:
                        if part.get("filename"):
                            filename = part["filename"]
                            mime_type = part.get("mimeType", "")

                            is_resume = filename.lower().endswith(".pdf")
                            is_email_attachment = (
                                filename.lower().endswith(".eml")
                                or mime_type == "message/rfc822"
                            )

                            if is_resume:
                                if "attachmentId" in part["body"]:
                                    attachment_id = part["body"]["attachmentId"]
                                    attachment = service.users().messages().attachments().get(
                                        userId="me", messageId=msg_id, id=attachment_id
                                    ).execute()

                                    data = attachment["data"]
                                    file_data = base64.urlsafe_b64decode(data)

                                    original_filename = filename
                                    counter = 1
                                    while filename in seen_filenames:
                                        name, ext = (
                                            original_filename.rsplit(".", 1)
                                            if "." in original_filename
                                            else (original_filename, "")
                                        )
                                        filename = f"{name}_{counter}.{ext}" if ext else f"{name}_{counter}"
                                        counter += 1

                                    seen_filenames.add(filename)

                                    resumes.append({
                                        "filename": filename,
                                        "content": file_data,
                                        "email_subject": subject,
                                        "email_body": body,
                                        "sender": sender_email,
                                    })
                                    logger.info(f"  ✅ Extracted: {filename} from '{subject}'")

                            elif is_email_attachment:
                                logger.info(f"  📧 Found .eml attachment: {filename}")

                                if "attachmentId" in part["body"]:
                                    attachment_id = part["body"]["attachmentId"]
                                    attachment = service.users().messages().attachments().get(
                                        userId="me", messageId=msg_id, id=attachment_id
                                    ).execute()

                                    data = attachment["data"]
                                    eml_content = base64.urlsafe_b64decode(data)

                                    try:
                                        msg_obj = email.message_from_bytes(eml_content)

                                        nested_sender = msg_obj.get("From", sender_email)
                                        nested_match = re.search(r'<(.+?)>', nested_sender)
                                        nested_email = nested_match.group(1) if nested_match else nested_sender
                                        if "@" not in nested_email:
                                            nested_email = ""

                                        for sub_part in msg_obj.walk():
                                            sub_fname = sub_part.get_filename()
                                            if sub_fname and sub_fname.lower().endswith(".pdf"):
                                                sub_content = sub_part.get_payload(decode=True)
                                                if sub_content:
                                                    resumes.append({
                                                        "filename": f"[Forwarded] {sub_fname}",
                                                        "content": sub_content,
                                                        "email_subject": subject,
                                                        "email_body": body,
                                                        "sender": nested_email,
                                                    })
                                                    logger.info(f"    ✅ Extracted from .eml: {sub_fname}")

                                    except Exception as e:
                                        logger.error(f"    ❌ Failed to parse .eml {filename}: {e}")

                except Exception as e:
                    logger.error(f"Error processing message {msg_info.get('id')}: {e}")
                    continue

            logger.info(f"Successfully extracted {len(resumes)} resume files from Gmail")
            return resumes

        except Exception as e:
            logger.error(f"Gmail fetch failed: {e}")
            raise

    def _extract_body(self, payload: dict) -> str:
        """Extract email body from message payload."""
        try:
            if "body" in payload and "data" in payload["body"]:
                data = payload["body"]["data"]
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")

            if "parts" in payload:
                for part in payload["parts"]:
                    if part.get("mimeType") == "text/plain":
                        if "data" in part.get("body", {}):
                            data = part["body"]["data"]
                            return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
            return ""
        except Exception as e:
            logger.warning(f"Could not extract email body: {e}")
            return ""

    def _get_all_parts(self, parts: List[Dict]) -> List[Dict]:
        """Recursively flatten all parts of an email message."""
        all_parts = []
        if not parts:
            return all_parts
        for part in parts:
            all_parts.append(part)
            if "parts" in part:
                all_parts.extend(self._get_all_parts(part["parts"]))
        return all_parts


# Singleton instance
gmail_fetch_service = GmailFetchService()
