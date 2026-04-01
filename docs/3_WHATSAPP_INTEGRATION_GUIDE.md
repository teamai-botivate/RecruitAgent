# 📱 WhatsApp Integration Complete Guide

## Overview

This guide explains how to integrate WhatsApp messaging into your recruitment system. Candidates will receive assessment invitations via WhatsApp with a personalized link and test details.

---

## ✅ Prerequisites

- A **Meta Business Account** (linked to your company)
- A **WhatsApp Business Account** (WABA)
- A **verified business phone number** for WhatsApp
- Access to **Meta Business Suite**
- An **OpenAI API key** (for system operations)
- **Google Sheets** set up with MessageLogs tracking

---

## 🔧 Part 1: Meta WhatsApp Cloud API Setup (15 minutes)

### Step 1.1: Access Meta Business Suite

1. Go to [business.facebook.com](https://business.facebook.com)
2. Sign in with your Meta/Facebook account
3. Click the **Settings gear icon** (bottom left) → **Accounts** → **Users**
4. You should see your business name in the dropdown

### Step 1.2: Create a WhatsApp Business Account (WABA)

If you don't have one:

1. Go to **Settings** → **WhatsApp accounts**
2. Click **"Add account"**
3. Create a new WhatsApp Business Account or connect an existing one
4. Note your **WABA ID** (you'll need it later)

### Step 1.3: Add and Verify Your Business Phone Number

1. Go to **Settings** → **Phone numbers**
2. Click **"Add phone number"**
3. Enter your company's phone number (must be unique to WhatsApp)
4. **Verification method:** Choose "Automatic" or "Manual SMS"
5. Complete verification
6. **Copy your Phone Number ID** (looks like: `807116282481629`)
   - This is critical for `.env` configuration

---

## 🎯 Part 2: Create WhatsApp Message Template (10 minutes)

### Why Templates?

Meta requires all bulk messages to use pre-approved templates. Our template has **6 variables**:

1. **{{1}}** → Candidate Name
2. **{{2}}** → Job Title
3. **{{3}}** → Test Date/Time
4. **{{4}}** → Duration (minutes)
5. **{{5}}** → Assessment Link
6. **{{6}}** → Company Name

### Step 2.1: Create Template in Meta Manager

1. Go to **Settings** → **Message Templates**
2. Click **"Create template"**
3. Fill in these details:

   **Template Name:** `assessment_invite_v1`
   
   **Category:** `UTILITY` (not MARKETING - important!)
   
   **Language:** `English` (NOT en_US - must match code = "en")
   
   **Body:**
   ```
   Hello {{1}},

   You're invited to take the {{2}} assessment at {{3}}.
   
   ⏱️ Duration: {{4}} minutes
   
   📋 Start your assessment here:
   {{5}}
   
   Company: {{6}}
   
   Good luck! 🎯
   ```

4. Click **"Submit for approval"**
5. **Status will be:** "Pending Review" → "Active - Quality Pending" (usually instant for Utility templates)

### Step 2.2: Verify Template Parameters

After approval, verify your template has exactly **6 parameters**:

1. Go to **Message Templates** list
2. Click on `assessment_invite_v1`
3. Confirm you see all 6 variable placeholders
4. **Template Language Code:** Should show "en" (NOT "en_US")

---

## 🔑 Part 3: Generate Production Access Token (10 minutes)

### Why System User Token?

You need a long-lived token with specific WhatsApp permissions. Temporary app tokens expire after 1-2 hours.

### Step 3.1: Create System User

1. Go to **Settings** → **Users** (in left sidebar)
2. Click **"+ Create system user"**
3. **Name:** `RecruitAI-Prod-WhatsApp`
4. **Role:** `Admin`
5. Click **"Create"**

### Step 3.2: Add App to System User

1. Click on the system user you just created
2. Under **"Apps and websites"** section:
   - Click **"+ Add apps"**
   - Select your app (create one if needed)
   - Required permissions:
     - ✅ `whatsapp_business_messaging`
     - ✅ `whatsapp_business_management`
     - ✅ `business_management`
3. Click **"Save changes"**

### Step 3.3: Generate Access Token

1. Still in the system user page
2. Click **"Generate new token"**
3. Select the app
4. Choose permissions again:
   - ✅ `whatsapp_business_messaging`
   - ✅ `whatsapp_business_management`
   - ✅ `business_management`
5. **Expiration:** Never (or 365 days)
6. Click **"Generate"**
7. **⚠️ COPY THIS TOKEN IMMEDIATELY** - you won't see it again!

### Step 3.4: Verify Token Works

Test your token with Meta's Graph API:

1. Go to [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)
2. Select your app from dropdown
3. In the search field, type: `/me/phone_numbers`
4. Paste your token in the "Access Token" field
5. Click **"Submit"**
6. **Should return** your phone numbers with Phone Number ID

---

## 🔌 Part 4: Webhook Setup (For Delivery Tracking) (10 minutes)

### What is a Webhook?

Meta's servers send your system real-time delivery updates:
- ✅ Message Delivered
- ✅ Message Read
- ❌ Message Failed

### Step 4.1: Configure Webhook in Meta

1. Go to **Settings** → **Webhooks** (or look in API section)
2. For your WhatsApp app, click **"Configure webhooks"**
3. Set these values:

   **Callback URL:**
   ```
   For Local Testing:
   http://localhost:8000/test/whatsapp/webhook
   
   For Hugging Face Deployment:
   https://[username]-[space-name].hf.space/test/whatsapp/webhook
   ```

   **Verify Token:** (Create a strong random string)
   ```
   Example: RecruitAI_WA_Verify_2026_4f9cA72dPqL8xM3v
   ```

4. Click **"Verify and Save"**
5. If verification fails, check:
   - Backend is running
   - Webhook route exists: `/test/whatsapp/webhook`
   - Token matches in `.env`

### Step 4.2: Subscribe to Events

1. Under **"Subscribe to webhook fields"** enable:
   - ✅ `message_status` (for Delivered/Read/Failed updates)

2. Click **"Save"**

### Step 4.3: Verify Webhook is Working

After sending a test WhatsApp message:

1. Go to **Google Sheets** → **MessageLogs** tab
2. Look for new rows with your test candidate
3. **Status should progress:** `Sent` → `Accepted` → `Delivered`
4. If stuck at `Accepted`, webhook isn't firing properly

---

## 📝 Part 5: Environment Configuration (.env Setup) (5 minutes)

### Step 5.1: Gather Your Credentials

You now have:
- ✅ **Phone Number ID:** `807116282481629` (from Part 1)
- ✅ **Access Token:** `<YOUR_PRODUCTION_TOKEN>` (from Part 3)
- ✅ **Template Name:** `assessment_invite_v1` (from Part 2)
- ✅ **Template Language:** `en` (from Part 2)
- ✅ **Webhook Verify Token:** `RecruitAI_WA_Verify_2026_4f9cA72dPqL8xM3v` (from Part 4)

### Step 5.2: Update .env File

Open `hiring_system_v2/backend/.env` and add/update:

```env
# WhatsApp Configuration
WHATSAPP_ENABLED=true
WHATSAPP_ACCESS_TOKEN=EAAFvxW6nfJgBABPqgR9ZwJ3o5... (your token)
WHATSAPP_PHONE_NUMBER_ID=807116282481629
WHATSAPP_API_VERSION=v22.0
WHATSAPP_TEMPLATE_NAME=assessment_invite_v1
WHATSAPP_TEMPLATE_LANG=en
WHATSAPP_COUNTRY_CODE=91
WHATSAPP_SEND_TIMEOUT=20
WHATSAPP_WEBHOOK_VERIFY_TOKEN=RecruitAI_WA_Verify_2026_4f9cA72dPqL8xM3v
```

**⚠️ CRITICAL NOTES:**
- `WHATSAPP_TEMPLATE_LANG=en` (NOT `en_US` or `en_GB`)
- `WHATSAPP_API_VERSION=v22.0` (use latest version)
- Never commit `.env` to Git
- For HF Space, add these as **Secrets** in Space Settings

### Step 5.3: Verify Configuration

Run this check:
```bash
cd hiring_system_v2/backend
python -c "from app.core.config import get_settings; s = get_settings(); print('✅ WhatsApp Enabled:', s.whatsapp_enabled); print('✅ Template:', s.whatsapp_template_name); print('✅ Language:', s.whatsapp_template_lang)"
```

Expected output:
```
✅ WhatsApp Enabled: True
✅ Template: assessment_invite_v1
✅ Language: en
```

---

## 🚀 Part 6: Send Your First WhatsApp Message

### Step 6.1: Prepare Test Data

Create a test candidate with a real WhatsApp phone number:

```json
{
  "name": "Test User",
  "email": "test@example.com",
  "phone": "919635781957"
}
```

**Important:** 
- Phone must be 10-15 digits
- Must be a valid WhatsApp account
- Use your own number for testing

### Step 6.2: Start Backend

```bash
cd hiring_system_v2/backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 6.3: Send Test Message

Using Postman or cURL:

```bash
curl -X POST http://localhost:8000/test/send \
  -H "Content-Type: application/json" \
  -d '{
    "jd_id": "JD-TEST",
    "candidates": [
      {
        "name": "Test User",
        "email": "test@example.com",
        "phone": "919635781957"
      }
    ],
    "channel": "whatsapp",
    "job_title": "Web Developer",
    "test_date": "2026-04-05 10:00 AM",
    "duration_minutes": 60,
    "assessment_link": "https://localhost:8000/take-test/test123",
    "mcq_count": 5,
    "coding_count": 0,
    "mcqs": [],
    "coding_questions": [],
    "company_name": "Your Company"
  }'
```

### Step 6.4: Check Message Status

1. **In Logs:**
   - Look for: `✅ WhatsApp send succeeded`
   - Or error: `❌ WhatsApp send failed` (will show error code)

2. **In Google Sheets:**
   - Go to **MessageLogs** tab
   - Find row with your email
   - Check **Status** column:
     - ✅ `Delivered` = Success!
     - 🟡 `Accepted` = Sent to Meta, waiting for delivery callback
     - ❌ `Failed` = Error occurred (check Error column)

3. **On Your Phone:**
   - You should receive WhatsApp message within 1-2 seconds

---

## ❌ Troubleshooting WhatsApp Issues

### Issue: Error #132000 - "Number of parameters does not match"

**Cause:** Backend sending wrong number of parameters

**Solution:**
1. Verify template has 6 variables (check Part 2)
2. Verify code is updated to send 6 parameters (checked in latest version)
3. Restart backend

### Issue: Error #132001 - "Template name does not exist in the translation"

**Cause:** Language code mismatch

**Solution:**
1. Check `.env` has `WHATSAPP_TEMPLATE_LANG=en` (NOT `en_US`)
2. Check Meta template language is "English" (not "en_US")
3. Restart backend

### Issue: Error #131047 - "Re-engagement message block"

**Cause:** Sending to wrong account or message window closed

**Solution:**
1. Verify Phone Number ID is correct (Part 1)
2. Verify Access Token belongs to right WABA
3. Only send within 24 hours of candidate interaction
4. Fall back to email if blocked (code handles this)

### Issue: Messages show "Accepted" but never "Delivered"

**Cause:** Webhook not configured or not firing

**Solution:**
1. Check webhook URL is correct in Meta
2. Check verify token matches `.env`
3. Check backend logs for webhook errors
4. Verify MessageLogs sheet is accessible

### Issue: "Invalid or missing phone"

**Cause:** Phone number format incorrect

**Solution:**
1. Ensure phone is 10-15 digits only
2. Remove spaces, dashes, special characters
3. Include country code (91 for India)
4. Must be a valid WhatsApp account

---

## 📊 Testing Checklist

- [ ] Meta template created: `assessment_invite_v1`
- [ ] Template status shows "Active"
- [ ] Template has 6 variables (all {{1}} to {{6}})
- [ ] Template language is "English" (code = "en")
- [ ] Phone number verified in Meta
- [ ] Phone Number ID copied: `807116282481629`
- [ ] System user created: `RecruitAI-Prod-WhatsApp`
- [ ] System user token generated
- [ ] Webhook configured with correct URL
- [ ] Webhook Verify Token created
- [ ] `.env` file updated with all 8 WhatsApp variables
- [ ] Backend restarted
- [ ] Test message sent successfully
- [ ] Message received on test phone within 2 seconds
- [ ] Google Sheets MessageLogs shows status progression
- [ ] ✅ Ready for production!

---

## 🔐 Security Notes

1. **Never commit `.env` to Git**
   - Add to `.gitignore`
   - Never share publicly

2. **Protect your Access Token**
   - Store securely (HF Space Secrets)
   - Rotate periodically
   - If exposed, regenerate immediately

3. **For Hugging Face Deployment**
   - Add all WhatsApp variables as Secrets
   - Not in code, not in Dockerfile
   - Only in HF Space Settings → Secrets

4. **Webhook Verification**
   - Use strong random token
   - Verify token in Meta matches code
   - Never expose in logs

---

**Next Step:** Go back to [0_DOCUMENTATION_INDEX.md](0_DOCUMENTATION_INDEX.md) to see full setup workflow.
