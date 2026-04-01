# RecruitAI: Complete Architecture & Deployment Guide

This document is the ultimate reference guide for configuring, running, and deploying the **RecruitAI** Hiring System. It covers setting up **Service Accounts** for Google Cloud integrations (Drive + Sheets) and details exactly how to deploy the Backend to **Hugging Face Spaces** and the Frontend to **Render**.

---

## Part 1: Setting up Google Integrations (`service_account.json`)

RecruitAI uses **Google Sheets** as its primary cloud database and **Google Drive** for resume storage. For a cloud backend to run smoothly without requiring browser log-ins, we use a **Google Cloud Service Account** instead of personal OAuth credentials. 

### Step 1.1: Creating a Service Account & Getting the JSON Key
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a **New Project** (e.g., "RecruitAI Production").
3. Go to **APIs & Services > Library** and enable the following APIs:
   - **Google Sheets API**
   - **Google Drive API**
4. Go to **IAM & Admin > Service Accounts**.
5. Click **+ Create Service Account**:
   - Give it a name like `recruit-ai-bot`.
   - The system will generate an email that looks like: `recruit-ai-bot@your-project-123.iam.gserviceaccount.com`. 
   - Note down this email address! You will need it in Step 1.2.
6. Skip the optional role assignments and click **Done**.
7. In the Service Accounts list, click the 3 vertical dots next to your new account and select **Manage Keys**.
8. Click **Add Key > Create New Key**.
9. Select **JSON** and click **Create**. The file will automatically download to your computer.
10. Rename this file to **`service_account.json`** and place it in the `hiring_system_v2/backend/` directory.

### Step 1.2: Linking the Database and Drive Folders
Because the Service Account acts as a separate "robot user", it does not have automatic access to your personal Google Drive or Sheets. **You must share your files with the bot.**

**To set up the Database:**
1. Create a blank Google Sheet in your personal Google account.
2. Click **Share** in the top right corner.
3. Paste the Service Account Email (`recruit-ai-bot@...`) and give it **Editor** permissions.
4. Copy the long ID from the spreadsheet URL:
   *(e.g., `https://docs.google.com/spreadsheets/d/` **THIS_IS_THE_ID** `/edit`)*
5. Add this to your `backend/.env` file:
   `SPREADSHEET_ID="THIS_IS_THE_ID"`

**To set up the Resume Storage (Using a Shared Drive):**
If your team uses a "Google Workspace Shared Drive" (Team Drive) to store candidate resumes:
1. Open your Google Drive and navigate to the **Shared Drives** section on the left panel.
2. Create or select a specific folder inside the Shared Drive (e.g., "RecruitAI_Resumes").
3. Right-click the **Shared Drive itself** (or the folder) and select **Manage Members / Share**.
4. Paste your Service Account Email (`recruit-ai-bot@...`) and assign it the **Content Manager** role. *(Editor role works for regular folders, but Content Manager is required for Shared Drives so the bot can write and modify files)*.
5. Open the target folder and copy the ID from the URL:
   *(e.g., `https://drive.google.com/drive/folders/` **THIS_IS_THE_ID**)*
6. Add this to your `backend/.env` file:
   `GOOGLE_DRIVE_FOLDER_ID="THIS_IS_THE_ID"`
   *(Our backend code automatically includes the `supportsAllDrives=True` parameter, so the API will natively handle Shared Drive uploads without throwing any errors!)*

*The backend is now fully configured and will automatically create all missing Database Tables when it runs.*

---

## Part 2: Backend Deployment (Hugging Face Spaces)

We will deploy the FastAPI backend using a Docker container to **Hugging Face Spaces**.

### Step 2.1: Prepare Backend for Deployment
Make sure your `backend` folder contains these files:
- `requirements.txt` (All python dependencies)
- `service_account.json` (Your Google Credentials)
- `Dockerfile`

**Sample Dockerfile** (Save this in `hiring_system_v2/backend/Dockerfile`):
```dockerfile
FROM python:3.10

WORKDIR /code

# Install dependencies first for Docker caching
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy the entire backend
COPY ./app /code/app
COPY service_account.json /code/service_account.json

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
```
*(Hugging face requires apps to run on port `7860`)*

### Step 2.2: Deploy to Hugging Face
1. Go to [Hugging Face Spaces](https://huggingface.co/spaces) and click **Create new Space**.
2. **Name:** `recruitai-backend`. 
3. **Space SDK:** Choose `Docker` -> `Blank`.
4. Click **Create Space**.
5. Upload your files via the UI or clone the Space repository using Git via the terminal:
   ```bash
   git clone https://huggingface.co/spaces/YOUR_USERNAME/recruitai-backend
   ```
6. Copy the contents of your `backend/` folder into the cloned directory, commit, and push.
7. **Environment Variables:** Go to the "Settings" tab of your HF Space. Under **Variables and secrets**, add:
   - `GEMINI_API_KEY`
   - `SPREADSHEET_ID`
   - `GOOGLE_DRIVE_FOLDER_ID`
8. Once the Docker container finishes building, your API base URL will be:
   `https://YOUR_USERNAME-recruitai-backend.hf.space`

---

## Part 3: Frontend Deployment (Render)

We will deploy the React (Vite) Frontend to **Render.com**. It is fast, free, and specifically optimized for Static Site hosting.

### Step 3.1: Configure API Endpoints
In your frontend codebase, ensure that API requests point to your Hugging Face Backend URL.
Create a `.env` or `.env.production` file inside `hiring_system_v2/frontend/`:
```env
VITE_API_BASE_URL="https://YOUR_USERNAME-recruitai-backend.hf.space"
```
*(Ensure all frontend `fetch()` calls utilize `import.meta.env.VITE_API_BASE_URL` instead of hardcoded `http://localhost:8000`)*

### Step 3.2: Deploying on Render
1. Push your `hiring_system_v2` code (or at least the `frontend` folder) to a GitHub repository.
2. Log in to [Render.com](https://render.com/).
3. Click **New +** and select **Static Site**.
4. Connect your GitHub account and select your repository.
5. In the Configuration page:
   - **Name:** `recruit-ai-dashboard`
   - **Root Directory:** `./frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish directory:** `dist`
6. Click **Create Static Site**.

### Step 3.3: Managing React Router (Redirects)
Because React is a Single Page Application (SPA), if a user refreshes a page on a deployed site, they might see a "404 Not Found" error. To fix this on Render:
1. Go to your front-end project in the Render Dashboard.
2. Go to the **Redirects/Rewrites** tab.
3. Add a new rule:
   - **Source:** `/*`
   - **Destination:** `/index.html`
   - **Action:** `Rewrite`
4. Click **Save Changes**.

---

## ✅ Deployment Checklist

- [ ] Google Cloud Service Account (`service_account.json`) created.
- [ ] Blank Google Sheet created and **shared with the Service Account email.**.
- [ ] Google Drive Folder created and **shared with the Service Account email**.
- [ ] IDs added to backend environment variables.
- [ ] Backend Dockerfile created and pushed to Hugging Face Spaces.
- [ ] HF Space environment secrets configured (`GEMINI_API_KEY`, etc.).
- [ ] Frontend API URLs updated to point to the live HF Space URL.
- [ ] Frontend deployed to Render.com via GitHub.
- [ ] Render Redirect rule added (`/*` -> `/index.html`).

*Your complete RecruitAI Pipeline is now fully deployed!*
