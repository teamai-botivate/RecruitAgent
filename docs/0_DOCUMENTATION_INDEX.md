# 📖 RecruitAI Complete Documentation Index

Welcome to the **RecruitAI Agentic Hiring Suite** documentation. This document helps you navigate all available guides.

---

## 🚀 Quick Start (Choose Your Path)

### I'm Setting Up Locally (Windows/Mac)
Start here: **[1_Setup_and_Configuration.md](1_Setup_and_Configuration.md)**
- Install Python
- Get API keys
- Configure Google integration
- Launch server locally
- **Time:** ~45 minutes

### I'm Deploying to Production (Hugging Face)
Start here: **[2_Deployment_Guide.md](2_Deployment_Guide.md)**
- Create HF Space
- Configure all credentials
- Set up webhooks
- Deploy code
- **Time:** ~60 minutes

### I Just Need WhatsApp Setup
Start here: **[3_WHATSAPP_INTEGRATION_GUIDE.md](3_WHATSAPP_INTEGRATION_GUIDE.md)**
- Meta Business setup
- Template creation
- Access token generation
- Webhook configuration
- **Time:** ~25 minutes

### I Need All Environment Variables
Check: **[4_ENV_CONFIGURATION_GUIDE.md](4_ENV_CONFIGURATION_GUIDE.md)**
- All .env variables explained
- Where to get credentials
- Security best practices

---

## 📚 Complete Documentation List

### Core Setup Guides

| Guide | Purpose | Time | For Whom |
|-------|---------|------|----------|
| **[1_Setup_and_Configuration.md](1_Setup_and_Configuration.md)** | Local development setup | 45 min | Everyone (read first) |
| **[2_Deployment_Guide.md](2_Deployment_Guide.md)** | Production cloud deployment | 60 min | Deployers |
| **[0_DOCUMENTATION_INDEX.md](0_DOCUMENTATION_INDEX.md)** | This document | 5 min | Navigation |

### Feature-Specific Guides

| Guide | Purpose | Prerequisites |
|-------|---------|----------------|
| **[3_WHATSAPP_INTEGRATION_GUIDE.md](3_WHATSAPP_INTEGRATION_GUIDE.md)** | WhatsApp messaging integration | Meta Business Account, phone number |
| **[4_ENV_CONFIGURATION_GUIDE.md](4_ENV_CONFIGURATION_GUIDE.md)** | All environment variables | Text editor |
| **[5_GOOGLE_SHEETS_DRIVE_SETUP.md](5_GOOGLE_SHEETS_DRIVE_SETUP.md)** | Google Sheets database & Drive storage | Google account, GCP project |

---

## 🎯 Setup Workflow (What to Do First)

### **Phase 1: Preparation** (5 minutes)
- [ ] Read this document
- [ ] Create accounts: Google, OpenAI, Meta (optional), Hugging Face (optional)
- [ ] Gather requirements

### **Phase 2: Google Setup** (20 minutes)
- [ ] Follow [5_GOOGLE_SHEETS_DRIVE_SETUP.md](5_GOOGLE_SHEETS_DRIVE_SETUP.md)
- [ ] Get: `client_secret.json`, `service_account.json`
- [ ] Get IDs: Sheet ID, Drive Folder ID

### **Phase 3: Configuration** (10 minutes)
- [ ] Create `.env` file in `hiring_system_v2/backend/`
- [ ] Reference: [4_ENV_CONFIGURATION_GUIDE.md](4_ENV_CONFIGURATION_GUIDE.md)
- [ ] Fill in all credentials

### **Phase 4a: Local Setup** (15 minutes)
- [ ] Follow [1_Setup_and_Configuration.md](1_Setup_and_Configuration.md)
- [ ] Run: `pip install -r requirements.txt`
- [ ] Start: `python -m uvicorn app.main:app --reload`
- [ ] Test at `http://localhost:8000`

### **Phase 4b: Cloud Deployment** (45 minutes)
- [ ] Follow [2_Deployment_Guide.md](2_Deployment_Guide.md)
- [ ] Create HF Space
- [ ] Push code
- [ ] Verify at `https://[username]-recruitai-backend.hf.space`

### **Phase 5: Optional - WhatsApp** (25 minutes)
- [ ] Follow [3_WHATSAPP_INTEGRATION_GUIDE.md](3_WHATSAPP_INTEGRATION_GUIDE.md)
- [ ] Create Meta template
- [ ] Generate access token
- [ ] Configure webhook
- [ ] Test send

---

## 🔑 Key Credentials Reference

### What You'll Need

| Credential | Where From | Where It Goes |
|------------|-----------|---------------|
| OpenAI API Key | [platform.openai.com](https://platform.openai.com) | `.env` - OPENAI_API_KEY |
| Gmail App Password | [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) | `.env` - SMTP_PASSWORD |
| client_secret.json | Google Cloud Console (OAuth) | `hiring_system_v2/backend/` |
| service_account.json | Google Cloud Console (Service Account) | `hiring_system_v2/backend/` |
| Google Sheet ID | Google Sheets URL | `.env` - GOOGLE_SPREADSHEET_ID |
| Google Drive Folder ID | Google Drive URL | `.env` - GOOGLE_DRIVE_FOLDER_ID |
| WhatsApp Phone Number ID | Meta Business Suite | `.env` - WHATSAPP_PHONE_NUMBER_ID |
| WhatsApp Access Token | Meta System User | `.env` - WHATSAPP_ACCESS_TOKEN |

---

## 📊 Features & Their Documentation

### ✅ Core Features

| Feature | Guide | Required | Setup Time |
|---------|-------|----------|-----------|
| **Resume Screening** | [1_Setup_and_Configuration.md](1_Setup_and_Configuration.md) | ✅ Yes | 45 min |
| **Gmail Integration** | [1_Setup_and_Configuration.md](1_Setup_and_Configuration.md) | ✅ Yes | 15 min |
| **Google Sheets Database** | [5_GOOGLE_SHEETS_DRIVE_SETUP.md](5_GOOGLE_SHEETS_DRIVE_SETUP.md) | ✅ Yes | 10 min |
| **Email Assessment Invites** | [1_Setup_and_Configuration.md](1_Setup_and_Configuration.md) | ✅ Yes | Included |
| **Aptitude Tests** | [1_Setup_and_Configuration.md](1_Setup_and_Configuration.md) | ✅ Yes | Included |

### 🎯 Optional Features

| Feature | Guide | Required | Setup Time |
|---------|-------|----------|-----------|
| **WhatsApp Messaging** | [3_WHATSAPP_INTEGRATION_GUIDE.md](3_WHATSAPP_INTEGRATION_GUIDE.md) | ❌ Optional | 25 min |
| **Webhook Delivery Tracking** | [3_WHATSAPP_INTEGRATION_GUIDE.md](3_WHATSAPP_INTEGRATION_GUIDE.md) | With WhatsApp | 10 min |
| **Cloud Deployment (HF)** | [2_Deployment_Guide.md](2_Deployment_Guide.md) | ❌ Optional | 60 min |

---

## 🔍 Troubleshooting Guide

### Common Issues by Symptom

**"I can't start the server"**
→ Check: [1_Setup_and_Configuration.md](1_Setup_and_Configuration.md) → Troubleshooting
→ Debug: [4_ENV_CONFIGURATION_GUIDE.md](4_ENV_CONFIGURATION_GUIDE.md)

**"Gmail authentication fails"**
→ Check: [1_Setup_and_Configuration.md](1_Setup_and_Configuration.md) → Gmail OAuth section
→ Verify: 2-FA enabled, app password correct

**"Google Sheets access denied"**
→ Check: [5_GOOGLE_SHEETS_DRIVE_SETUP.md](5_GOOGLE_SHEETS_DRIVE_SETUP.md) → Part 3
→ Share service account email with Sheet & Folder

**"WhatsApp messages not sending"**
→ Check: [3_WHATSAPP_INTEGRATION_GUIDE.md](3_WHATSAPP_INTEGRATION_GUIDE.md) → Part 6

---

## 📞 Quick Reference

### Folder Structure

```
hiring_system_v2/
├── docs/
│   ├── 0_DOCUMENTATION_INDEX.md         ← YOU ARE HERE
│   ├── 1_Setup_and_Configuration.md     ← Local setup
│   ├── 2_Deployment_Guide.md            ← Cloud deployment
│   ├── 3_WHATSAPP_INTEGRATION_GUIDE.md  ← WhatsApp setup
│   ├── 4_ENV_CONFIGURATION_GUIDE.md     ← .env reference
│   └── 5_GOOGLE_SHEETS_DRIVE_SETUP.md   ← Google APIs
│
├── backend/
│   ├── app/
│   │   ├── api/                 ← REST endpoints
│   │   ├── services/            ← Business logic
│   │   ├── core/
│   │   │   └── config.py        ← Loads .env
│   │   └── models/
│   │       └── schemas.py
│   │
│   ├── .env                     ← YOUR CREDENTIALS (don't commit!)
│   ├── client_secret.json       ← Gmail OAuth (don't commit!)
│   ├── service_account.json     ← Google service account (don't commit!)
│   ├── requirements.txt
│   └── README.md
│
└── frontend/
    ├── index.html
    ├── script.js
    └── styles.css
```

---

## ✅ Checklist Before Going Live

- [ ] All APIs enabled in Google Cloud Console
- [ ] `client_secret.json` downloaded and placed in `backend/`
- [ ] `service_account.json` downloaded and placed in `backend/`
- [ ] `.env` file created with all REQUIRED variables filled
- [ ] Gmail app password generated and verified
- [ ] OpenAI API key tested
- [ ] Google Sheet created with all required tabs
- [ ] Drive folder created and shared with service account
- [ ] Backend starts without errors: `python -m uvicorn app.main:app --reload`
- [ ] Frontend loads at `http://localhost:8000`
- [ ] ✅ (Optional) WhatsApp template created and approved
- [ ] ✅ (Optional) WhatsApp webhook configured

---

**Questions?** Refer to the appropriate guide above or check the troubleshooting section.
