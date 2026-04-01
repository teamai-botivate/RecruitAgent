# 📋 Google Sheets & Drive Complete Setup Guide

## Overview

Your recruitment system uses **Google Sheets** as a database and **Google Drive** for storing resumes and reports. This guide walks you through setup for both local and cloud deployment.

---

## Part 1: Create Google Sheets Database

### Step 1.1: Create a New Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com)
2. Click **"+ New"** → **"Google Sheets"**
3. Name it: `RecruitAI-Database`
4. Share with your hiring team
5. **Copy the Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
                                          ^^^^^^^^
   ```
   Example: `1lcGSx_om7lU-FvV6Fm-uh6HVzbrbGonsu1_FD4LfdUo`

### Step 1.2: Create Required Sheets (Tabs)

Your Google Sheet must have these tabs. Create each one:

#### Tab 1: **Pipelines** (Job Postings)

| Column | Type | Example |
|--------|------|---------|
| pipeline_id | Text | JD-DADB6A25 |
| title | Text | Web Developer |
| state | Text | ACTIVE/COMPLETED |
| jd_text | Text | Full job description |
| created_at | Date | 2026-04-01 |
| updated_at | Date | 2026-04-01 |

#### Tab 2: **Candidates** (Shortlisted)

| Column | Type | Example |
|--------|------|---------|
| candidate_id | Text | CAND-001 |
| name | Text | Gautam Gupta |
| email | Text | gautam@example.com |
| phone | Text | 919635781957 |
| resume_url | URL | https://drive.google.com/... |
| screening_score | Number | 85 |
| status | Text | Shortlisted/Rejected/Interview |
| jd_id | Text | JD-DADB6A25 |
| added_date | Date | 2026-04-01 |

#### Tab 3: **ScheduledTests** (Assessment Invites)

| Column | Type | Example |
|--------|------|---------|
| test_id | Text | TEST-001 |
| candidate_email | Text | gautam@example.com |
| candidate_name | Text | Gautam Gupta |
| jd_id | Text | JD-DADB6A25 |
| test_token | Text | l7k1rly19umng3umxo |
| sent_date | Date | 2026-04-01 |
| test_status | Text | Sent/Completed/Expired |
| mcq_score | Number | 40 |
| mcq_total | Number | 50 |
| coding_score | Number | 0 |
| coding_total | Number | 0 |

#### Tab 4: **GeneratedTests** (Question Banks)

| Column | Type | Example |
|--------|------|---------|
| test_id | Text | TEST-001 |
| jd_id | Text | JD-DADB6A25 |
| mcq_questions | Text | [JSON array] |
| coding_questions | Text | [JSON array] |
| created_at | Date | 2026-04-01 |

#### Tab 5: **MessageLogs** (WhatsApp/Email Tracking)

| Column | Type | Example |
|--------|------|---------|
| timestamp | DateTime | 2026-04-01 13:52:16 |
| jd_id | Text | JD-DADB6A25 |
| candidate_email | Text | gautam@example.com |
| candidate_phone | Text | 919635781957 |
| test_token | Text | l7k1rly19umng3umxo |
| channel | Text | Email/WhatsApp |
| status | Text | Sent/Accepted/Delivered/Read/Failed |
| message_id | Text | wamid.HBgMOTE... |
| error | Text | #132000 or blank if success |

#### Tab 6: **AnalyticsSummary** (Dashboard)

| Column | Type | Example |
|--------|------|---------|
| date | Date | 2026-04-01 |
| jd_id | Text | JD-DADB6A25 |
| applications_received | Number | 25 |
| shortlisted | Number | 5 |
| tests_sent | Number | 5 |
| tests_completed | Number | 3 |
| avg_mcq_score | Number | 72.5 |
| screening_completion_rate | Number | 60% |

### Step 1.3: Set Sharing Permissions

1. Click **Share** (top right)
2. Add your team members with **Editor** access
3. **Important:** Keep sheet **NOT publicly shared** (security)

---

## Part 2: Create Google Drive Folder Structure

### Step 2.1: Create Main Folder

1. Go to [drive.google.com](https://drive.google.com)
2. Click **"+ New"** → **"Folder"**
3. Name it: `RecruitAI-Data`
4. **Copy the Folder ID:**
   ```
   https://drive.google.com/drive/folders/[FOLDER_ID]
                                         ^^^^^^^^^
   ```

### Step 2.2: Create Subfolders

Inside `RecruitAI-Data`, create:

```
RecruitAI-Data/
├── JD-Uploads/           (Original job descriptions)
├── Resumes/              (All downloaded resumes)
│   ├── Shortlisted/      (Passed screening)
│   └── Rejected/         (Failed screening)
├── Assessment-Results/   (Test reports)
└── Reports/              (Final hiring reports)
```

### Step 2.3: Share Folder with App

1. Right-click `RecruitAI-Data` folder
2. Click **Share**
3. You'll share with service account email in Step 3 below

---

## Part 3: Create Google Cloud Service Account

### Why a Service Account?

Your app needs to read/write to Sheets and Drive **without user login**. Service accounts do this automatically.

### Step 3.1: Go to Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. At the top, select a project (create new if needed)

### Step 3.2: Enable Required APIs

1. Search bar → Type **"Google Sheets API"**
2. Click result and press **ENABLE**
3. Search bar → Type **"Google Drive API"**
4. Click result and press **ENABLE**

### Step 3.3: Create Service Account

1. Click **menu icon** (three lines, top left)
2. Go to **APIs & Services** → **Credentials**
3. Click **"+ CREATE CREDENTIALS"** → **"Service account"**
4. Fill in:
   - **Service account name:** `RecruitAI-Backend`
   - **Description:** "Recruitment system backend"
5. Click **"Create and Continue"**
6. **Grant role:**
   - Click **"Select a role"** dropdown
   - Search for: `Editor`
   - Select **"Editor"**
7. Click **"Continue"** → **"Done"**

### Step 3.4: Generate JSON Key

1. In **Credentials** page, click the service account you created
2. Go to **"Keys"** tab
3. Click **"Add Key"** → **"Create new key"**
4. Choose **"JSON"**
5. Click **"Create"**
6. File downloads automatically
7. **Rename it:** `service_account.json`
8. **Move to:** `hiring_system_v2/backend/`

⚠️ **This file contains credentials. Never commit to Git!**

### Step 3.5: Share Google Sheet with Service Account

1. Open downloaded `service_account.json` (text editor)
2. Find the **"client_email"** field:
   ```
   "client_email": "recruitai-backend@project-id.iam.gserviceaccount.com"
   ```
3. Copy this email address
4. Go to your **Google Sheet** (`RecruitAI-Database`)
5. Click **Share** (top right)
6. Paste the email
7. Give **Editor** access
8. Uncheck "Notify people"
9. Click **Share**

### Step 3.6: Share Google Drive Folder with Service Account

1. Same email from Step 3.5
2. Go to `RecruitAI-Data` folder in Drive
3. Click **Share**
4. Paste the service account email
5. Give **Editor** access
6. Click **Share**

---

## Part 4: Create Gmail OAuth Client

You also need `client_secret.json` for Gmail authentication.

### Step 4.1: Create OAuth 2.0 Credentials

In Google Cloud Console:

1. Go to **APIs & Services** → **Credentials**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth 2.0 Client ID"**
3. If prompted, configure OAuth consent screen first (click Configure)
4. In OAuth consent:
   - **App name:** RecruitAI
   - **User support email:** Your email
   - **Developer contact:** Your email
   - Click **"Save and Continue"**
5. **Scopes:** Add these scopes:
   - `https://mail.google.com/` (Gmail)
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/drive`
6. Click **"Save and Continue"** → **"Back to Dashboard"**

### Step 4.2: Create Credentials

1. Click **"+ CREATE CREDENTIALS"** → **"OAuth 2.0 Client ID"**
2. **Application type:** "Web application"
3. **Name:** "RecruitAI Backend"
4. Under **"Authorized redirect URIs"** add:
   ```
   http://localhost:8000/auth/gmail/callback
   http://localhost:8000/auth/gmail/callback
   https://[your-username]-recruitai-backend.hf.space/auth/gmail/callback
   ```
5. Click **"Create"**
6. A popup shows your credentials
7. Click **"Download"** (or download JSON later)
8. **Rename downloaded file:** `client_secret.json`
9. **Move to:** `hiring_system_v2/backend/`

---

## Part 5: Update .env Configuration

### Step 5.1: Gather Your IDs

You now have:
- ✅ **GOOGLE_SPREADSHEET_ID:** `1lcGSx_om7lU-FvV6Fm-uh6HVzbrbGonsu1_FD4LfdUo`
- ✅ **GOOGLE_DRIVE_FOLDER_ID:** `0AK5eLMIMUwQMUk9PVA`
- ✅ **SERVICE_ACCOUNT_FILE:** `service_account.json`
- ✅ **GMAIL_CLIENT_SECRET_FILE:** `client_secret.json`

### Step 5.2: Update .env File

Open `hiring_system_v2/backend/.env`:

```env
# Google Sheets & Drive
GOOGLE_SPREADSHEET_ID=1lcGSx_om7lU-FvV6Fm-uh6HVzbrbGonsu1_FD4LfdUo
GOOGLE_DRIVE_FOLDER_ID=0AK5eLMIMUwQMUk9PVA
SERVICE_ACCOUNT_FILE=hiring_system_v2/backend/service_account.json
GMAIL_CLIENT_SECRET_FILE=hiring_system_v2/backend/client_secret.json
```

---

## Part 6: Verify Everything Works

### Step 6.1: Test Sheets Connection

```bash
cd hiring_system_v2/backend
python -c "
from app.services.sheets_service import sheets_db
print('Testing Sheets connection...')
pipelines = sheets_db.get_pipelines()
print('✅ Successfully connected to Sheets!')
print(f'Found {len(pipelines)} pipelines')
"
```

**Expected output:**
```
Testing Sheets connection...
✅ Successfully connected to Sheets!
Found 0 pipelines
```

### Step 6.2: Test Drive Connection

```bash
python -c "
from app.services.drive_service import drive_service
print('Testing Drive connection...')
# Replace with your folder ID
files = drive_service.list_files_in_folder('[YOUR_FOLDER_ID]')
print('✅ Successfully connected to Drive!')
print(f'Folder contains {len(files)} files')
"
```

### Step 6.3: Verify All Sheets Tabs Exist

1. Open your Google Sheet
2. Verify all 6 tabs at bottom:
   - ✅ Pipelines
   - ✅ Candidates
   - ✅ ScheduledTests
   - ✅ GeneratedTests
   - ✅ MessageLogs
   - ✅ AnalyticsSummary

---

## 📋 Credentials Checklist

Before proceeding, verify you have:

- [ ] Google Sheet created: `RecruitAI-Database`
- [ ] Sheet ID copied: `1lcGSx_om7lU-FvV6Fm-uh6HVzbrbGonsu1_FD4LfdUo`
- [ ] All 6 tabs created in Sheet
- [ ] Drive folder created: `RecruitAI-Data`
- [ ] Drive Folder ID copied: `0AK5eLMIMUwQMUk9PVA`
- [ ] Drive subfolders created
- [ ] Google Cloud project created
- [ ] Google Sheets API enabled
- [ ] Google Drive API enabled
- [ ] Service account created: `RecruitAI-Backend`
- [ ] `service_account.json` downloaded to `backend/`
- [ ] Service account shared with Sheet (Editor)
- [ ] Service account shared with Drive folder (Editor)
- [ ] Gmail OAuth configured
- [ ] `client_secret.json` downloaded to `backend/`
- [ ] `.env` updated with all IDs
- [ ] Connection tests passed ✅

---

## 🔐 Security Notes

1. **Never commit JSON files to Git**
   ```bash
   echo "client_secret.json
   service_account.json" >> .gitignore
   ```

2. **Keep IDs private**
   - Don't share sheet ID/folder ID publicly
   - Credentials are sensitive

3. **For Hugging Face Deployment**
   - Upload JSON files as **Secrets** (not in code)
   - Use Space Settings → Secrets
   - Reference in `.env`

4. **Minimum Permissions**
   - Service Account: **Editor** (Drive/Sheets only)
   - OAuth Client: Only needed scopes

---

## 🚨 Common Errors

### "service_account.json not found"
- Download from Google Cloud Console
- Rename correctly
- Place in `backend/` directory

### "Permission denied" accessing Sheets
- Verify service account email is shared
- Check sharing permission is "Editor"
- Restart backend

### "Invalid service account credentials"
- Download fresh JSON from Google Cloud
- Check content is valid JSON
- Verify file path in `.env`

---

**Next Steps:**
1. Return to [0_DOCUMENTATION_INDEX.md](0_DOCUMENTATION_INDEX.md)
2. Continue with [1_Setup_and_Configuration.md](1_Setup_and_Configuration.md)
3. Or proceed to [3_WHATSAPP_INTEGRATION_GUIDE.md](3_WHATSAPP_INTEGRATION_GUIDE.md) if ready
