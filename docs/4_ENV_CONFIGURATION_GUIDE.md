# ⚙️ Complete .env Configuration Guide

## Overview

The `.env` file contains all sensitive credentials and configuration for your recruitment system. This guide explains each variable and where to get it.

---

## 📍 File Location

Place `.env` in this directory:
```
hiring_system_v2/backend/.env
```

---

## 🔑 All Configuration Variables

### 1. OpenAI Configuration (REQUIRED)

```env
OPENAI_API_KEY=sk-proj-U8lcJm38Z2hAtvR403MuYaAzRJwqtH2F0kDOd0S0HERhloqdKtTRjtGJY5F
```

**How to get:**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Click **API keys** (left sidebar)
3. Click **"Create new secret key"**
4. Copy immediately (you won't see it again!)

**Note:** You need at least $5 credit in OpenAI account.

---

### 2. Groq API Configuration (OPTIONAL)

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx
```

**How to get:**
1. Go to [console.groq.com](https://console.groq.com)
2. Sign in and create account
3. Go to **API Keys**
4. Click **"Create API Key"**
5. Copy the key

**Note:** Optional. Leave blank to use only OpenAI.

---

### 3. HuggingFace Configuration (OPTIONAL)

```env
HUGGINGFACE_API_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxx
```

**How to get:**
1. Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Click **"New token"**
3. Type: "Read"
4. Click **"Create new token"**
5. Copy immediately

---

### 4. Server Configuration (LOCAL/DEV)

```env
PORT=8000
HOST=0.0.0.0
BASE_URL=http://localhost:8000
```

**For Local Testing:** Use as-is

**For Hugging Face Space:** Change to:
```env
BASE_URL=https://[your-username]-[your-space-name].hf.space
```

---

### 5. SMTP/Email Configuration (REQUIRED)

```env
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=team.ai@botivate.in
SMTP_PASSWORD=pjwzgrgaknbqbjca
```

**How to set up Email:**

#### Option A: Gmail App Password (RECOMMENDED)

1. Enable 2-Factor Authentication on Gmail
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Select **Mail** and **Windows Computer**
4. Google generates 16-character password
5. Remove spaces and paste to `SMTP_PASSWORD`

#### Option B: Regular Gmail Password (Not Recommended)

1. Enable "Less secure app access"
2. Use your actual Gmail password

---

### 6. Google Sheets Configuration (REQUIRED)

```env
GOOGLE_SPREADSHEET_ID=1lcGSx_om7lU-FvV6Fm-uh6HVzbrbGonsu1_FD4LfdUo
GOOGLE_DRIVE_FOLDER_ID=0AK5eLMIMUwQMUk9PVA
```

**How to get:**

**Spreadsheet ID:**
1. Open your Google Sheet
2. Copy from URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`

**Drive Folder ID:**
1. Open your Google Drive Folder
2. Copy from URL: `https://drive.google.com/drive/folders/[FOLDER_ID]`

---

### 7. Service Account Configuration (REQUIRED)

```env
SERVICE_ACCOUNT_FILE=hiring_system_v2/backend/service_account.json
GMAIL_CLIENT_SECRET_FILE=hiring_system_v2/backend/client_secret.json
```

**How to get `service_account.json`:**

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select your project
3. Click **"APIs & Services"** → **"Credentials"**
4. Click **"+ Create Credentials"** → **"Service Account"**
5. Fill details and click **"Create"**
6. Go to **"Keys"** tab → **"Add Key"** → **"Create new key"**
7. Choose **"JSON"**
8. Downloaded file: rename to `service_account.json`
9. Place in `hiring_system_v2/backend/`

**How to get `client_secret.json`:**

1. In Google Cloud Console, **Credentials**
2. Click **"+ Create Credentials"** → **"OAuth 2.0 Client ID"** → **"Web Application"**
3. Add redirect URI: `http://localhost:8000/auth/gmail/callback`
4. Click **"Create"**
5. Click **"Download JSON"** (or download from Credentials list)
6. Rename to `client_secret.json`
7. Place in `hiring_system_v2/backend/`

**Detailed Steps:** See [5_GOOGLE_SHEETS_DRIVE_SETUP.md](5_GOOGLE_SHEETS_DRIVE_SETUP.md)

---

### 8. WhatsApp Configuration (OPTIONAL but RECOMMENDED)

```env
WHATSAPP_ENABLED=true
WHATSAPP_ACCESS_TOKEN=EAAFvxW6nfJgBABPqgR9ZwJ3o5UX8zYZAtZw9ZCw8M8P0xvJ0UKm4T
WHATSAPP_PHONE_NUMBER_ID=807116282481629
WHATSAPP_API_VERSION=v22.0
WHATSAPP_TEMPLATE_NAME=assessment_invite_v1
WHATSAPP_TEMPLATE_LANG=en
WHATSAPP_COUNTRY_CODE=91
WHATSAPP_SEND_TIMEOUT=20
WHATSAPP_WEBHOOK_VERIFY_TOKEN=RecruitAI_WA_Verify_2026_4f9cA72dPqL8xM3v
```

**Setup:** See [3_WHATSAPP_INTEGRATION_GUIDE.md](3_WHATSAPP_INTEGRATION_GUIDE.md)

**Critical Notes:**
- `WHATSAPP_TEMPLATE_LANG=en` (NOT `en_US`)
- `WHATSAPP_ACCESS_TOKEN` must be system user token (not temporary)
- Token should never expire
- Keep strictly private

---

## 📋 Complete Example .env File

```env
# ===== REQUIRED =====

# OpenAI
OPENAI_API_KEY=sk-proj-xxxxx

# Email (SMTP)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=team.ai@botivate.in
SMTP_PASSWORD=xxxxxxxxxxxx

# Google
GOOGLE_SPREADSHEET_ID=1lcGSx_om7lU-FvV6Fm-uh6HVzbrbGonsu1_FD4LfdUo
GOOGLE_DRIVE_FOLDER_ID=0AK5eLMIMUwQMUk9PVA
SERVICE_ACCOUNT_FILE=hiring_system_v2/backend/service_account.json
GMAIL_CLIENT_SECRET_FILE=hiring_system_v2/backend/client_secret.json

# Server
PORT=8000
HOST=0.0.0.0
BASE_URL=http://localhost:8000

# ===== OPTIONAL BUT RECOMMENDED =====

# WhatsApp
WHATSAPP_ENABLED=true
WHATSAPP_ACCESS_TOKEN=EAAFvxW6nfJgBABPqgR9ZwJ3o5UX8zYZAtZw9ZCw8M8P0xvJ0UKm4T
WHATSAPP_PHONE_NUMBER_ID=807116282481629
WHATSAPP_API_VERSION=v22.0
WHATSAPP_TEMPLATE_NAME=assessment_invite_v1
WHATSAPP_TEMPLATE_LANG=en
WHATSAPP_COUNTRY_CODE=91
WHATSAPP_SEND_TIMEOUT=20
WHATSAPP_WEBHOOK_VERIFY_TOKEN=RecruitAI_WA_Verify_2026_4f9cA72dPqL8xM3v

# ===== OPTIONAL =====

GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx
HUGGINGFACE_API_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxx
```

---

## 🔄 Local vs Cloud Configuration

### Local Development
```env
BASE_URL=http://localhost:8000
WHATSAPP_WEBHOOK_VERIFY_TOKEN=RecruitAI_WA_Verify_2026_4f9cA72dPqL8xM3v
```

### Hugging Face Space
```env
BASE_URL=https://[your-username]-recruitai-backend.hf.space
WHATSAPP_WEBHOOK_VERIFY_TOKEN=RecruitAI_WA_Verify_2026_4f9cA72dPqL8xM3v
```

---

## ✅ Validation Checklist

Before starting your server, verify:

```bash
# Check .env exists
ls hiring_system_v2/backend/.env

# Check required files exist
ls hiring_system_v2/backend/service_account.json
ls hiring_system_v2/backend/client_secret.json

# Test configuration loads
cd hiring_system_v2/backend
python -c "
from app.core.config import get_settings
s = get_settings()
print('✅ OpenAI Key:', 'SET' if s.openai_api_key else 'MISSING')
print('✅ Gmail User:', s.smtp_user)
print('✅ Sheet ID:', s.google_spreadsheet_id)
print('✅ WhatsApp Enabled:', s.whatsapp_enabled)
print('✅ All required vars configured!')
"
```

Expected output:
```
✅ OpenAI Key: SET
✅ Gmail User: team.ai@botivate.in
✅ Sheet ID: 1lcGSx_om7lU-FvV6Fm-uh6HVzbrbGonsu1_FD4LfdUo
✅ WhatsApp Enabled: True
✅ All required vars configured!
```

---

## 🔐 Security Best Practices

1. **Never commit `.env` to Git**
   ```bash
   # Add to .gitignore
   echo ".env
   .env.local
   client_secret.json
   service_account.json" >> .gitignore
   ```

2. **Protect API Keys**
   - Store in `.env` (local development)
   - Use environment variables (production)
   - For HF Space: Use **Secrets** feature

3. **For Hugging Face Space**
   - Go to Space Settings → Secrets
   - Add each variable as a secret (NOT in Dockerfile)
   - HF automatically injects as env variables

4. **Rotate Credentials Periodically**
   - Generate new OpenAI keys
   - Regenerate WhatsApp tokens
   - Update service account keys

5. **Minimum Permissions**
   - Service account: Editor on Drive/Sheets only
   - WhatsApp token: Only necessary permissions
   - Gmail: Only Mail + Drive scopes

---

## 🚨 Common Errors & Fixes

### Error: "OPENAI_API_KEY not found"
- Check `.env` file exists
- Verify key is not empty
- Ensure no extra quotes

### Error: "service_account.json not found"
- Download from Google Cloud Console
- Place in `hiring_system_v2/backend/`
- Check file path in `.env`

### Error: "SMTP authentication failed"
- Verify Gmail address is correct
- Regenerate app password (2-FA must be on)
- Don't use spaces in password

### Error: "WhatsApp credentials missing"
- Set `WHATSAPP_ENABLED=true`
- Fill all 8 WhatsApp variables
- Restart backend after updating

---

**Next Steps:**
- Local setup: See [1_Setup_and_Configuration.md](1_Setup_and_Configuration.md)
- Cloud deployment: See [2_Deployment_Guide.md](2_Deployment_Guide.md)
- WhatsApp setup: See [3_WHATSAPP_INTEGRATION_GUIDE.md](3_WHATSAPP_INTEGRATION_GUIDE.md)
