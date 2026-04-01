"""
PDF Service - Text and Email Extraction from PDFs
Exact same logic as original Backend/app/services/pdf_service.py
"""

import io
import re
from pypdf import PdfReader


class PDFService:
    """Handles PDF text extraction and email discovery."""

    def extract_text(self, file_content: bytes) -> tuple:
        """
        Extract text from PDF bytes.
        Prioritizes pdfplumber (layout-aware), falls back to pypdf.
        Returns: (text, page_count)
        """
        text = ""
        page_count = 0

        # Method 1: pdfplumber (Superior Layout Handling)
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                page_count = len(pdf.pages)
                for page in pdf.pages:
                    page_text = page.extract_text(layout=True)
                    if page_text:
                        text += page_text + "\n"
            return self._clean_text(text), page_count
        except ImportError:
            pass
        except Exception as e:
            print(f"pdfplumber failed: {e}. Falling back to pypdf.")

        # Method 2: pypdf (Fallback)
        try:
            pdf = PdfReader(io.BytesIO(file_content))
            page_count = len(pdf.pages)
            for page in pdf.pages:
                page_text = page.extract_text()
                if not page_text or len(page_text.strip()) < 5:
                    try:
                        page_text = page.extract_text(extraction_mode="layout")
                    except:
                        pass
                if page_text:
                    text += page_text + "\n"
            return self._clean_text(text), page_count
        except Exception as e:
            print(f"PDF Extraction Failed: {e}")
            return "", 0

    def _clean_text(self, text: str) -> str:
        """Clean common encoding issues in extracted text."""
        if not text:
            return ""
        text = text.replace('\x00', '')
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()

    def extract_emails_advanced(self, file_content: bytes) -> str:
        """
        Advanced Email Extraction using PyMuPDF (fitz).
        Extracts both visible text and hidden mailto: links.
        Returns the first valid email found, or empty string.
        """
        try:
            import pymupdf as fitz
        except ImportError:
            import fitz

        email_pattern = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
        found_emails = []

        try:
            with fitz.open(stream=file_content, filetype="pdf") as doc:
                for page in doc:
                    # 1. Visible Text
                    text = page.get_text("text")
                    text_emails = re.findall(email_pattern, text)
                    for email in text_emails:
                        if email not in found_emails:
                            found_emails.append(email)

                    # 2. Hyperlinks (mailto: or raw email in URI)
                    links = page.get_links()
                    for link in links:
                        if "uri" in link:
                            uri = link["uri"].strip()
                            email = ""
                            if uri.startswith("mailto:"):
                                email = uri.replace("mailto:", "").strip()
                            elif "@" in uri and "." in uri and not uri.startswith("http") and not uri.startswith("www"):
                                email = uri

                            if "?" in email:
                                email = email.split("?")[0]
                            if email and email not in found_emails:
                                found_emails.append(email)

            # Filter out placeholders
            placeholders = ["[email]", "email@example.com", "name@email.com", "yourname@email.com", "user@domain.com", "email"]
            valid_emails = []
            for email in found_emails:
                clean_email = email.lower().strip()
                if clean_email not in placeholders and "example.com" not in clean_email and "@" in email and "." in email:
                    valid_emails.append(email)

            return valid_emails[0] if valid_emails else ""
        except Exception as e:
            print(f"Advanced Email Extraction Failed: {e}")
            return ""


# Singleton instance
pdf_service = PDFService()
