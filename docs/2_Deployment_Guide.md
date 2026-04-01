# RecruitAI: Deployment Guide

This guide ensures your RecruitAI application is robustly deployed to the cloud, utilizing free yet powerful tiers across Hugging Face (Backend) and Render.com (Frontend).

> **Prerequisite:** This guide assumes your `service_account.json`, Google Sheets, and Drive folders are successfully configured locally. If not, complete `docs/1_Setup_and_Configuration.md` first.

---

## 1. Backend Deployment (Hugging Face Spaces)

We deploy the FastAPI backend using Docker to Hugging Face Spaces. It offers generous bandwidth and container resources for AI-based applications.

### 1.1 The Dockerfile
Ensure a `Dockerfile` exists inside `hiring_system_v2/backend/` with the following:
```dockerfile
FROM python:3.10
WORKDIR /code
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt
COPY ./app /code/app
COPY service_account.json /code/service_account.json
# Hugging Face exposes exactly port 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
```

### 1.2 Depoying the Docker Container
1. Go to [Hugging Face Spaces](https://huggingface.co/spaces) -> **Create new Space**.
2. **Name:** `recruitai-backend`. 
3. **Space SDK:** Choose `Docker` -> `Blank`.
4. Click **Create Space**.
5. Upload the contents of your `backend/` directory to this space (via the browser UI or `git clone`).
6. Go to the **Settings** tab of your HF Space.
7. Under **Variables and secrets**, add all required backend environment variables:
   - `OPENAI_API_KEY`
   - `GOOGLE_SPREADSHEET_ID`
   - `GOOGLE_DRIVE_FOLDER_ID`
   - `SERVICE_ACCOUNT_FILE=service_account.json`
   - `GMAIL_CLIENT_SECRET_FILE=client_secret.json`
   - `BASE_URL=https://botivate2026-recruitai-backend.hf.space`
   - Optional WhatsApp: `WHATSAPP_ENABLED`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_SEND_GAP_SECONDS`
8. The Space will automatically build. Your Production Backend API is now live at:
   `https://botivate2026-recruitai-backend.hf.space`

### 1.3 Mandatory: WhatsApp Webhook Configuration (For Real Delivery Status)
If you only send via API, message logs can show `Accepted` while the user still does not receive the message.

1. Open Meta Developer Dashboard -> WhatsApp -> Configuration.
2. Set callback URL:
   - `https://botivate2026-recruitai-backend.hf.space/test/whatsapp/webhook`
3. Set Verify Token to exactly match your Space variable `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
4. Subscribe message status fields (`sent`, `delivered`, `read`, `failed`).

After this, `MessageLogs` in Sheets auto-updates to real final status (`Delivered`/`Read`/`Failed`).

---

## 2. Frontend Deployment (Render.com)

Render hosts pure React Single-Page Applications extremely well under their Static Site umbrella.

### 2.1 Updating API Endpoints
Before deploying, the React app must know how to talk to the Hugging Face API rather than `localhost:8000`.
1. Inside `hiring_system_v2/frontend/`, create a file named `.env.production`.
2. Add the base URL:
```env
VITE_API_BASE_URL="https://YOUR_USERNAME-recruitai-backend.hf.space"
```

For this project, use:

```env
VITE_API_BASE_URL="https://botivate2026-recruitai-backend.hf.space"
```
*(Make sure to use `import.meta.env.VITE_API_BASE_URL` recursively in your `fetch()` logic).*

### 2.2 Pushing to Render
1. Push your entire project to a **GitHub Repository**.
2. Log in to [Render.com](https://render.com/).
3. Click **New +** -> **Static Site**.
4. Connect GitHub and select your repository.
5. In Configuration:
   - **Name:** `recruitai-dashboard`
   - **Root Directory:** `./frontend` (or wherever your package.json lives)
   - **Build Command:** `npm install && npm run build`
   - **Publish directory:** `dist`
6. Click **Create Static Site**.

### 2.3 Solving React Router 404 Refresh Issues
1. In the Render Dashboard for your new site, click on the **Redirects/Rewrites** tab.
2. Add the following rule:
   - **Source:** `/*`
   - **Destination:** `/index.html`
   - **Action:** `Rewrite`
3. Hit **Save**.

Your entire pipeline is now Live, scalable, and connected securely to your backend AI tools and Google Workspaces!
