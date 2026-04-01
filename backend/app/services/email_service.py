"""
Email Service - Professional email templates with Gmail OAuth + SMTP fallback
"""

import os
import time
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional

from .gmail_oauth import gmail_oauth_service
from ..core.config import get_settings
from ..utils.text import clean_job_title

settings = get_settings()
logger = logging.getLogger(__name__)

COMPANY_ID = "default_company"


def _send_via_gmail_api(to: str, subject: str, body: str) -> bool:
    try:
        if gmail_oauth_service.is_connected(COMPANY_ID):
            gmail_oauth_service.send_email(COMPANY_ID, to, subject, body)
            return True
    except Exception as e:
        logger.warning(f"Gmail OAuth Send failed: {e}")
    return False


def _send_via_smtp(to: str, subject: str, body: str, is_html: bool = True):
    if not all([settings.smtp_user, settings.smtp_password]):
        raise Exception("Mail service unreachable. Connect Gmail via Dashboard.")

    server = smtplib.SMTP(settings.smtp_server, settings.smtp_port, timeout=10)
    server.starttls()
    server.login(settings.smtp_user, settings.smtp_password)

    msg = MIMEMultipart()
    msg["From"] = settings.smtp_user
    msg["To"] = to
    msg["Subject"] = subject
    msg["Reply-To"] = "no-reply@botivate.in"
    msg.attach(MIMEText(body, "html" if is_html else "plain"))

    server.send_message(msg)
    server.quit()


def send_email(to: str, subject: str, body: str):
    if not _send_via_gmail_api(to, subject, body):
        _send_via_smtp(to, subject, body)


# ──────────────────────────────────────────────────────────────
# Shared email wrapper with branded header/footer
# ──────────────────────────────────────────────────────────────

def _branded_email(company_name: str, inner_html: str) -> str:
    """Wrap content in a professionally branded email template."""
    return f"""
    <html>
    <body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Segoe UI', Arial, sans-serif;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-top: 20px; margin-bottom: 20px;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #6366f1, #0ea5e9); padding: 28px 32px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">{company_name}</h1>
          <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 13px;">Talent Acquisition Platform</p>
        </div>

        <!-- Body Content -->
        <div style="padding: 32px;">
          {inner_html}
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="margin: 0 0 6px; font-size: 12px; color: #94a3b8;">This is an automated communication from <strong>{company_name}</strong>.</p>
          <p style="margin: 0 0 6px; font-size: 12px; color: #94a3b8;">Please do not reply to this email.</p>
          <p style="margin: 0; font-size: 11px; color: #cbd5e1;">Powered by <a href="https://botivate.in" style="color: #6366f1; text-decoration: none;">Botivate</a></p>
        </div>
      </div>
    </body>
    </html>
    """


# ──────────────────────────────────────────────────────────────
# Assessment Invitation Email
# ──────────────────────────────────────────────────────────────

def send_assessment_emails(
    candidates: list,
    job_title: str,
    mcq_count: int,
    coding_count: int,
    assessment_link: str,
    company_name: str = "RecruitAI",
    test_date: str = "",
    duration_minutes: int = 60,
):
    clean_title = clean_job_title(job_title)
    
    # Build assessment details table
    details_rows = f'<tr><td style="padding: 8px 12px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Role</td><td style="padding: 8px 12px; font-weight: 600; color: #1e293b; border-bottom: 1px solid #f1f5f9;">{clean_title}</td></tr>'
    
    if test_date and test_date != "Immediate":
        details_rows += f'<tr><td style="padding: 8px 12px; color: #64748b; border-bottom: 1px solid #f1f5f9;">📅 Test Date</td><td style="padding: 8px 12px; font-weight: 600; color: #1e293b; border-bottom: 1px solid #f1f5f9;">{test_date}</td></tr>'
    
    details_rows += f'<tr><td style="padding: 8px 12px; color: #64748b; border-bottom: 1px solid #f1f5f9;">⏱️ Duration</td><td style="padding: 8px 12px; font-weight: 600; color: #1e293b; border-bottom: 1px solid #f1f5f9;">{duration_minutes} Minutes</td></tr>'
    
    if mcq_count > 0:
        details_rows += f'<tr><td style="padding: 8px 12px; color: #64748b; border-bottom: 1px solid #f1f5f9;">📝 MCQ Questions</td><td style="padding: 8px 12px; font-weight: 600; color: #1e293b; border-bottom: 1px solid #f1f5f9;">{mcq_count}</td></tr>'
    
    if coding_count > 0:
        details_rows += f'<tr><td style="padding: 8px 12px; color: #64748b; border-bottom: 1px solid #f1f5f9;">💻 Coding Problems</td><td style="padding: 8px 12px; font-weight: 600; color: #1e293b; border-bottom: 1px solid #f1f5f9;">{coding_count}</td></tr>'
    
    details_rows += f'<tr><td style="padding: 8px 12px; color: #64748b;">🖥️ Environment</td><td style="padding: 8px 12px; font-weight: 600; color: #1e293b;">Online Proctored</td></tr>'

    for i, cand in enumerate(candidates):
        email_addr = cand.get("email", cand) if isinstance(cand, dict) else cand
        cand_name = cand.get("name", "Candidate") if isinstance(cand, dict) else "Candidate"

        subject = f"Assessment Invitation | {clean_title} — {company_name}"
        
        inner = f"""
          <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">Congratulations, {cand_name}! 🎉</h2>
          <p style="color: #64748b; margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
            Your profile for the <strong style="color: #1e293b;">{clean_title}</strong> position at <strong style="color: #6366f1;">{company_name}</strong> has been shortlisted. 
            You are invited to complete an online technical assessment.
          </p>

          <!-- Details Table -->
          <div style="background: #f8fafc; border-radius: 10px; overflow: hidden; margin-bottom: 24px; border: 1px solid #e2e8f0;">
            <div style="background: #1e293b; padding: 12px 16px;">
              <h3 style="margin: 0; color: #ffffff; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Assessment Details</h3>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              {details_rows}
            </table>
          </div>

          <!-- Rules Box -->
          <div style="background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <h4 style="margin: 0 0 10px; color: #92400e; font-size: 14px;">⚠️ Important Guidelines</h4>
            <ul style="margin: 0; padding-left: 18px; color: #78350f; font-size: 13px; line-height: 1.8;">
              <li>Working <strong>webcam</strong> is mandatory throughout the test</li>
              <li>Tab switching will be <strong>detected and flagged</strong></li>
              <li>Test will <strong>auto-submit</strong> when the timer expires</li>
              <li>Use a <strong>desktop or laptop</strong> — mobile devices are not permitted</li>
              <li>No external resources, notes, or assistance allowed</li>
            </ul>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin-bottom: 20px;">
            <a href="{assessment_link}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #0ea5e9); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(99,102,241,0.4);">
              Enter Test Environment →
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 0;">
            This link is unique to you. Do not share it with anyone.
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="color: #475569; font-size: 14px; margin: 0;">
            Best regards,<br>
            <strong style="color: #1e293b;">{company_name}</strong> — Hiring Team
          </p>
        """

        body = _branded_email(company_name, inner)
        send_email(email_addr, subject, body)
        logger.info(f"  ✅ Assessment email sent to {email_addr} ({i+1}/{len(candidates)})")

        if i < len(candidates) - 1:
            time.sleep(3)


# ──────────────────────────────────────────────────────────────
# Rejection Email
# ──────────────────────────────────────────────────────────────

def send_rejection_emails(emails: List[str], job_title: str, company_name: str = "RecruitAI"):
    clean_title = clean_job_title(job_title)

    for i, email_addr in enumerate(emails):
        subject = f"Application Update — {clean_title} | {company_name}"

        inner = f"""
          <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Application Update</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.7;">
            Dear Candidate,
          </p>
          <p style="color: #475569; font-size: 15px; line-height: 1.7;">
            Thank you for your interest in the <strong style="color: #1e293b;">{clean_title}</strong> position at <strong style="color: #6366f1;">{company_name}</strong> 
            and for taking the time to go through our selection process.
          </p>
          <p style="color: #475569; font-size: 15px; line-height: 1.7;">
            After careful consideration, we have decided to move forward with other candidates whose qualifications more closely align with our current requirements. 
            This decision was not easy, and we truly appreciate the effort you put into your application and assessment.
          </p>
          
          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #166534; font-size: 14px; line-height: 1.6;">
              💡 <strong>Your profile remains in our talent pool.</strong> We may reach out to you for future opportunities that match your skill set. 
              We encourage you to continue applying for positions that interest you.
            </p>
          </div>

          <p style="color: #475569; font-size: 15px; line-height: 1.7;">
            We wish you the very best in your career journey.
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="color: #475569; font-size: 14px; margin: 0;">
            Warm regards,<br>
            <strong style="color: #1e293b;">{company_name}</strong> — Talent Acquisition Team
          </p>
        """

        body = _branded_email(company_name, inner)
        send_email(email_addr, subject, body)
        logger.info(f"  ✅ Rejection email sent to {email_addr} ({i+1}/{len(emails)})")

        if i < len(emails) - 1:
            time.sleep(3)


# ──────────────────────────────────────────────────────────────
# Interview Invitation Email
# ──────────────────────────────────────────────────────────────

def send_interview_emails(
    emails: List[str],
    job_title: str,
    date: str,
    time_str: str,
    location: str,
    company_name: str = "RecruitAI",
):
    clean_title = clean_job_title(job_title)

    for i, email_addr in enumerate(emails):
        subject = f"Interview Scheduled | {clean_title} — {company_name}"

        inner = f"""
          <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">You're Invited for an Interview! 🎯</h2>
          <p style="color: #64748b; margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
            Congratulations! Based on your outstanding assessment performance, we would like to invite you for an interview for the 
            <strong style="color: #1e293b;">{clean_title}</strong> position at <strong style="color: #6366f1;">{company_name}</strong>.
          </p>

          <!-- Interview Details Card -->
          <div style="background: linear-gradient(135deg, #f8fafc, #eef2ff); border: 1px solid #c7d2fe; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 16px; color: #4338ca; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">📋 Interview Details</h3>
            <table style="width: 100%; font-size: 15px; color: #1e293b;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; width: 120px;">📅 Date</td>
                <td style="padding: 8px 0; font-weight: 700;">{date}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">⏰ Time</td>
                <td style="padding: 8px 0; font-weight: 700;">{time_str}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">📍 Location</td>
                <td style="padding: 8px 0; font-weight: 700;">{location}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">👔 Dress Code</td>
                <td style="padding: 8px 0; font-weight: 600;">Business Professional</td>
              </tr>
            </table>
          </div>

          <!-- Preparation Tips -->
          <div style="background: #eff6ff; border: 1px solid #93c5fd; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <h4 style="margin: 0 0 10px; color: #1e40af; font-size: 14px;">📌 What to Bring</h4>
            <ul style="margin: 0; padding-left: 18px; color: #1e3a5f; font-size: 13px; line-height: 1.8;">
              <li>Government-issued photo ID</li>
              <li>Updated resume (hard copy)</li>
              <li>Any relevant portfolio or project documentation</li>
              <li>Please arrive <strong>15 minutes early</strong></li>
            </ul>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="color: #475569; font-size: 14px; margin: 0;">
            Looking forward to meeting you!<br>
            <strong style="color: #1e293b;">{company_name}</strong> — Hiring Team
          </p>
        """

        body = _branded_email(company_name, inner)
        send_email(email_addr, subject, body)
        logger.info(f"  ✅ Interview email sent to {email_addr} ({i+1}/{len(emails)})")

        if i < len(emails) - 1:
            time.sleep(3)


# ──────────────────────────────────────────────────────────────
# Submission Notification (to recruiter)
# ──────────────────────────────────────────────────────────────

def send_submission_notification(submission: dict, job_title: str = "Unknown Role"):
    recruiter_email = settings.smtp_user
    if not recruiter_email:
        return

    suspicious = submission.get('suspicious', 'Normal')
    status_color = '#ef4444' if suspicious != 'Normal' else '#10b981'

    subject = f"📊 Test Submitted: {submission['email']} — {job_title}"

    inner = f"""
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">New Assessment Submission</h2>
      <p style="color: #64748b; font-size: 15px; margin: 0 0 20px;">A candidate has completed their technical evaluation.</p>

      <div style="background: #f8fafc; border-radius: 10px; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <table style="width: 100%; font-size: 14px; color: #1e293b;">
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Candidate</td>
            <td style="padding: 8px 0; font-weight: 700;">{submission['email']}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Role</td>
            <td style="padding: 8px 0; font-weight: 600;">{job_title}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">MCQ Score</td>
            <td style="padding: 8px 0; font-weight: 700;">{submission.get('mcq_score', 0)} / {submission.get('mcq_total', 0)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Coding Score</td>
            <td style="padding: 8px 0; font-weight: 700;">{submission.get('coding_score', 0)} / {submission.get('coding_total', 0)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Proctoring</td>
            <td style="padding: 8px 0; font-weight: 700; color: {status_color};">{suspicious}</td>
          </tr>
        </table>
      </div>

      <p style="color: #64748b; font-size: 14px;">View full details in the RecruitAI dashboard.</p>
    """

    body = _branded_email("RecruitAI", inner)

    try:
        send_email(recruiter_email, subject, body)
        logger.info(f"✅ Submission notification sent for {submission['email']}")
    except Exception as e:
        logger.error(f"❌ Failed to send submission notification: {e}")
