"""
Gmail OAuth 2.0 Service
Handles Google OAuth flow and token management for Gmail access.
Exact same logic as original Backend/app/services/gmail_oauth.py
"""

import os
import json
import pickle
import base64
import shutil
from pathlib import Path
from typing import Optional, Dict
from email.message import EmailMessage

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from ..core.config import get_settings


class GmailOAuthService:
    """Manages Gmail OAuth 2.0 authentication and token storage."""

    SCOPES = [
        "https://mail.google.com/",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/gmail.readonly",
    ]
    CLIENT_SECRET_FILE = "client_secret.json"
    TOKEN_DIR = "tokens"

    def __init__(self):
        self.settings = get_settings()
        self.backend_dir = Path(__file__).parent.parent.parent
        self.root_dir = self.backend_dir.parent

        configured = str(self.settings.gmail_client_secret_file or self.CLIENT_SECRET_FILE).strip()
        configured_path = Path(configured)
        configured_name = configured_path.name if configured_path.name else self.CLIENT_SECRET_FILE

        potential_paths = [
            configured_path,
            self.backend_dir / configured,
            self.root_dir / configured,
            Path.cwd() / configured,
            self.backend_dir / configured_name,
            self.root_dir / configured_name,
            Path.cwd() / configured_name,
            Path("/code") / configured_name,
            Path("/code") / self.CLIENT_SECRET_FILE,
        ]

        self.client_secret_path = potential_paths[0]
        for path in potential_paths:
            if path.exists():
                self.client_secret_path = path
                print(f"✅ Found client_secret.json at: {path}")
                break

        self.token_dir = self.backend_dir / self.TOKEN_DIR
        self.token_dir.mkdir(exist_ok=True)

        # Clear tokens on restart
        try:
            for item in self.token_dir.iterdir():
                if item.is_file():
                    item.unlink()
            print("🧹 Gmail OAuth tokens cleared for fresh start.")
        except Exception as e:
            print(f"⚠️ Failed to clear tokens: {e}")

        if not self.client_secret_path.exists():
            print("⚠️  WARNING: client_secret.json not found in any standard locations.")

    def get_authorization_url(self, company_id: str, redirect_uri: str) -> tuple:
        """Generate OAuth authorization URL."""
        flow = Flow.from_client_secrets_file(
            str(self.client_secret_path),
            scopes=self.SCOPES,
            redirect_uri=redirect_uri,
        )

        authorization_url, state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )

        code_verifier = getattr(flow, "code_verifier", None)

        state_file = self.token_dir / f"{company_id}_state.json"
        with open(state_file, "w") as f:
            json.dump({"state": state, "redirect_uri": redirect_uri, "code_verifier": code_verifier}, f)

        return authorization_url, state

    def handle_callback(self, company_id: str, code: str, state: str) -> Dict:
        """Handle OAuth callback and exchange code for tokens."""
        state_file = self.token_dir / f"{company_id}_state.json"
        if not state_file.exists():
            raise ValueError("Invalid state: No matching OAuth session found")

        with open(state_file, "r") as f:
            stored_data = json.load(f)

        if stored_data["state"] != state:
            raise ValueError("Invalid state: CSRF protection failed")

        flow = Flow.from_client_secrets_file(
            str(self.client_secret_path),
            scopes=self.SCOPES,
            redirect_uri=stored_data["redirect_uri"],
        )

        try:
            flow.fetch_token(code=code, code_verifier=stored_data.get("code_verifier"))
        except Exception as e:
            if "code verifier" in str(e).lower():
                flow.fetch_token(code=code)
            else:
                raise e

        credentials = flow.credentials
        self._save_credentials(company_id, credentials)

        service = build("gmail", "v1", credentials=credentials)
        profile = service.users().getProfile(userId="me").execute()
        user_email = profile.get("emailAddress")

        try:
            state_file.unlink()
        except:
            pass

        return {
            "status": "success",
            "email": user_email,
            "message": f"Successfully connected to {user_email}",
        }

    def get_credentials(self, company_id: str) -> Optional[Credentials]:
        """Get stored credentials for a company."""
        token_file = self.token_dir / f"{company_id}_token.pickle"

        if not token_file.exists():
            return None

        try:
            with open(token_file, "rb") as f:
                credentials = pickle.load(f)

            if credentials and credentials.expired and credentials.refresh_token:
                try:
                    credentials.refresh(Request())
                    self._save_credentials(company_id, credentials)
                except Exception as e:
                    print(f"OAUTH_DEBUG: Token refresh failed: {e}")
                    return None

            return credentials
        except Exception as e:
            print(f"OAUTH_DEBUG: Error loading credentials: {e}")
            return None

    def _save_credentials(self, company_id: str, credentials: Credentials):
        """Save credentials to file with disk sync."""
        token_file = self.token_dir / f"{company_id}_token.pickle"
        with open(token_file, "wb") as f:
            pickle.dump(credentials, f)
            f.flush()
            os.fsync(f.fileno())

    def get_gmail_service(self, company_id: str):
        """Get authenticated Gmail API service."""
        credentials = self.get_credentials(company_id)
        if not credentials:
            raise ValueError(f"Gmail not connected for {company_id}")
        return build("gmail", "v1", credentials=credentials)

    def send_email(self, company_id: str, to: str, subject: str, body: str):
        """Send an email through Gmail API (HTTPS based, bypasses SMTP blocks)."""
        if not company_id:
            company_id = "default_company"

        try:
            service = self.get_gmail_service(company_id)

            credentials = self.get_credentials(company_id)
            token_scopes = getattr(credentials, "scopes", []) or []

            profile = service.users().getProfile(userId="me").execute()
            user_email = profile.get("emailAddress")

            if "https://www.googleapis.com/auth/gmail.send" not in token_scopes:
                raise ValueError(
                    f"MISSING_SEND_PERMISSION: Connected as {user_email}, but 'Send Email' scope is missing."
                )

            message = EmailMessage()
            message.set_content(body, subtype="html")
            message["To"] = to
            message["From"] = user_email
            message["Subject"] = subject
            message["Reply-To"] = "no-reply@botivate.in"
            message["Auto-Submitted"] = "auto-generated"
            message["X-Auto-Response-Suppress"] = "All"

            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()

            send_result = service.users().messages().send(
                userId="me", body={"raw": raw_message}
            ).execute()

            return send_result
        except Exception as e:
            print(f"❌ Gmail API Send Error: {e}")
            raise e

    def revoke_access(self, company_id: str) -> bool:
        """Revoke Gmail access and delete tokens."""
        token_file = self.token_dir / f"{company_id}_token.pickle"
        if token_file.exists():
            try:
                credentials = self.get_credentials(company_id)
                if credentials:
                    credentials.revoke(Request())
            except:
                pass
            token_file.unlink()
        return True

    def is_connected(self, company_id: str) -> bool:
        """Check if we have valid credentials with required scopes."""
        try:
            credentials = self.get_credentials(company_id)
            if not credentials:
                return False

            if not credentials.valid:
                return False

            token_scopes = getattr(credentials, "scopes", []) or []
            if isinstance(token_scopes, str):
                token_scopes = token_scopes.split(" ")

            has_at_least_one = False
            for s in self.SCOPES:
                if s in token_scopes:
                    has_at_least_one = True
                    break

            if not has_at_least_one:
                print(f"❌ OAUTH_CHECK: No required scopes found in token.")
                return False

            for s in self.SCOPES:
                if s not in token_scopes:
                    print(f"⚠️  OAUTH_CHECK: Missing scope: {s}")

            return True
        except Exception as e:
            print(f"OAUTH_CHECK_ERROR: {e}")
            return False


# Singleton instance
gmail_oauth_service = GmailOAuthService()
