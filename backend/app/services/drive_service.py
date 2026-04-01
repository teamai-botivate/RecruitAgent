"""
Drive Service - Persistent file storage in Google Drive
"""

import os
import logging
from pathlib import Path
from typing import Optional
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from ..core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive'
]

class DriveStorageService:
    def __init__(self):
        self.folder_id = settings.google_drive_folder_id
        self.service = None
        self._initialize_service()

    def _initialize_service(self):
        if not self.folder_id:
            logger.warning("No GOOGLE_DRIVE_FOLDER_ID set. Drive Storage disabled.")
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
            return

        try:
            creds = service_account.Credentials.from_service_account_file(
                str(service_account_path), scopes=SCOPES
            )
            self.service = build('drive', 'v3', credentials=creds)
            logger.info("✅ Connected to Google Drive Storage")
        except Exception as e:
            logger.error(f"Failed to connect to Google Drive: {e}")

    def get_or_create_folder(self, folder_name: str, parent_id: Optional[str] = None) -> Optional[str]:
        """
        Retrieves a folder ID by name, or creates it if it doesn't exist.
        Ensures folders exist before uploading files into them.
        """
        if not self.service:
            return None
        
        parent = parent_id or self.folder_id
        
        # Search for existing folder
        query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and '{parent}' in parents and trashed=false"
        try:
            results = self.service.files().list(
                q=query, spaces='drive', fields='files(id, name)', supportsAllDrives=True, includeItemsFromAllDrives=True
            ).execute()
            
            items = results.get('files', [])
            if items:
                return items[0]['id']  # Return existing folder ID
            
            # Create new folder
            folder_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent]
            }
            folder = self.service.files().create(
                body=folder_metadata, fields='id', supportsAllDrives=True
            ).execute()
            
            return folder.get('id')
            
        except Exception as e:
            logger.error(f"Error getting/creating Drive folder '{folder_name}': {e}")
            return parent  # Fallback to parent on error

    def upload_file(self, file_path: str, filename: str, target_folder_id: Optional[str] = None) -> Optional[str]:
        """
        Uploads a file to Google Drive (inside target_folder_id) and returns the webViewLink.

        """
        if not self.service or not os.path.exists(file_path):
            return None

        # Determine subfolder or just upload to main folder
        parent_folders = [target_folder_id or self.folder_id]

        file_metadata = {
            'name': filename,
            'parents': parent_folders
        }

        # Check mimetype based on extension
        mimetype = 'application/octet-stream'
        if filename.endswith('.pdf'):
            mimetype = 'application/pdf'
        elif filename.endswith('.json'):
            mimetype = 'application/json'

        try:
            media = MediaFileUpload(file_path, mimetype=mimetype, resumable=True)
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, webViewLink',
                supportsAllDrives=True
            ).execute()
            
            logger.info(f"File uploaded to Drive: {filename} (ID: {file.get('id')})")
            
            # --- 🔓 FIX: Make file public for viewing in iframe ---
            try:
                self.service.permissions().create(
                    fileId=file.get('id'),
                    body={'type': 'anyone', 'role': 'viewer'},
                    supportsAllDrives=True
                ).execute()
                logger.info(f"✅ Permissions set: Anyone with link can view {filename}")
            except Exception as perm_err:
                logger.warning(f"Failed to set public permissions: {perm_err}")
                
            return file.get('webViewLink')


        except Exception as e:
            logger.error(f"Error uploading file to Drive: {e}")
            return None

    def get_file_bytes(self, file_id: str):
        """Fetch raw bytes of a file for streaming (bypasses permission issues)."""
        if not self.service:
            return None
        try:
            import io
            from googleapiclient.http import MediaIoBaseDownload
            
            request = self.service.files().get_media(fileId=file_id, supportsAllDrives=True)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()
            
            fh.seek(0)
            return fh.read()
        except Exception as e:
            logger.error(f"Error downloading file bytes from Drive: {e}")
            return None


drive_storage = DriveStorageService()
