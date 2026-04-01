# RecruitAI: Setup & Configuration Guide

This guide covers the prerequisites and local setup required to run **RecruitAI** on your machine and connect it to Google's cloud services (Sheets and Drive).

---

## 1. Prerequisites
- **Python 3.10+** (for the backend)
- **Node.js 18+** (for the frontend React app)
- **Google Cloud Platform (GCP)** Account

---

## 2. Google Cloud Service Account Setup
RecruitAI uses a **Service Account** to run headlessly (without needing browser logins). 

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a **New Project** (e.g., "RecruitAI Development").
3. Go to **APIs & Services > Library** and enable:
   - **Google Sheets API**
   - **Google Drive API**
4. Go to **IAM & Admin > Service Accounts**.
5. Click **+ Create Service Account** (Name: `recruit-ai-bot`).
6. Copy the generated Bot Email: `recruit-ai-bot@your-project-123.iam.gserviceaccount.com`. 
7. Click the 3 dots next to the account -> **Manage Keys** -> **Add Key > Create New Key** -> **JSON**.
8. Save this file as `service_account.json` inside the `hiring_system_v2/backend/` directory.

---

## 3. Database & Storage Mapping

### 3.1 Connect Google Sheets (Database)
1. Create a blank Google Sheet in your personal or company account.
2. Click **Share** (top right).
3. Paste the Service Account Email (`recruit-ai-bot@...`) and set permission to **Editor**.
4. Copy the long ID from the URL (between `/d/` and `/edit`).

### 3.2 Connect Google Workspace Shared Drive (Storage)
If using a "Shared Drive" (Team Drive) to store PDF resumes:
1. Open Google Drive -> **Shared Drives**.
2. Right-click your Shared Drive (or a specific folder inside it) and click **Manage Members / Share**.
3. Paste the Service Account Email and assign it the **Content Manager** role. *(Content Manager is strictly required for Shared Drive API uploads).*
4. Copy the Folder ID from the URL.

---

## 4. Local Environment Setup

### Backend
1. Open `hiring_system_v2/backend/`
2. Create a file named `.env` and configure your keys:
```env
# Google Cloud
GOOGLE_SPREADSHEET_ID="your_google_sheet_id_here"
GOOGLE_DRIVE_FOLDER_ID="your_drive_folder_id_here"
SERVICE_ACCOUNT_FILE="service_account.json"
GMAIL_CLIENT_SECRET_FILE="client_secret.json"
BASE_URL="http://localhost:8000"

# AI Integrations
OPENAI_API_KEY="your_openai_key_here"

# WhatsApp (optional but recommended)
WHATSAPP_ENABLED="true"
WHATSAPP_ACCESS_TOKEN="your_meta_permanent_token"
WHATSAPP_PHONE_NUMBER_ID="your_meta_phone_number_id"
WHATSAPP_API_VERSION="v18.0"
WHATSAPP_COUNTRY_CODE="91"
WHATSAPP_SEND_GAP_SECONDS="2"
WHATSAPP_WEBHOOK_VERIFY_TOKEN="set_any_long_random_string"
```
3. Place both credential files in the backend folder:
   - `service_account.json`
   - `client_secret.json`
4. If using Gmail OAuth, add redirect URI in Google Cloud OAuth Client:
   - Local: `http://localhost:8000/auth/gmail/callback`
   - HF Deployment: `https://your-space-name.hf.space/auth/gmail/callback`
5. Run the backend:
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # (On Mac: source venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
*Note: Upon first run, the system will automatically create all missing Database Tables in your connected Google Sheet!*

### Frontend
1. Open `hiring_system_v2/frontend/`
2. Run the frontend:
```bash
cd frontend
npm install
npm run dev
```

### WhatsApp Delivery Reality Check
- `Accepted` means Meta accepted your API request.
- Final status (`Delivered`, `Read`, `Failed`) is received asynchronously through webhook callbacks.
- Without webhook setup in deployment, you cannot prove real delivery.

You are now ready to develop or test locally! For deployment to the internet, please see `docs/2_Deployment_Guide.md`.
