# 🚀 RecruitAI - Intelligent Hiring Pipeline (v2)

RecruitAI is a full-stack, AI-driven recruitment automation system designed to minimize manual HR reviews. It transforms unstructured job descriptions into precise filtering pipelines, generates contextual aptitude assessments, and manages interview operations seamlessly over a Google Sheets Database.

## ✨ System Architecture

- **Frontend:** React + Vite + Custom CSS (Lucide-React for styling).
- **Backend:** FastAPI (Python 3.10+).
- **AI Core:** Google Gemini Integration (LangChain integrations ready).
- **Database:** Fully Serverless (Google Sheets + Google Drive).
- **Authentication:** Headless Service Account JSON protocol.

## 🛠 Features Explained

1. **Job Description Vectorization:** Pastes a JD and instantly determines requirements using GenAI.
2. **Mass Resume Screening:** Upload 100s of CVs instantly. Resumes are temporarily saved and securely scored against the JD.
3. **Strict Data Retention Policy:** Rejected candidates are instantly wiped from the platform after a rejection email is dispatched.
4. **Google Workspace Sync:** Selected candidates have their original PDF resumes uploaded directly to a Google Workspace Shared Drive and the generated URL mapped to the Google Sheets Candidate DB.
5. **Generative Aptitude Tests:** Generates targeted MCQs and dynamic coding questions. Automatically grades candidate code executions.
6. **Universal HR Dashboard:** Includes the "Candidate Profile Modal" injected across all tabs allowing HR to view Drive Resumes, AI reasoning logic, and Test Result Keys alongside decision-making tools.

## 🔄 The Hiring Workflow

RecruitAI is segmented into sequential stages:
1. `Dashboard`: Base Campaign / JD Creation Overview.
2. `Resume Screening`: Ingest PDFs -> Reject Poor Matches -> Persist Stars.
3. `Aptitude Generation`: Create highly specific, adaptive AI test rounds.
4. `Schedule Tests`: Send out dispatch links.
5. `Results Analysis`: Read proctoring statuses, answer checks, and finalize interview invites.
6. `Scheduled Interviews`: Mark outcomes.
7. `Joined`: Permanent ledger of hired candidates filtered by JD.

---

## 📚 Documentation & Setup Guides

Instead of a monolithic README, we have split critical configuration and deployment steps into clear markdown guides:

1. **[Setup & Configuration Guide](docs/1_Setup_and_Configuration.md)**: 
   - Learn how to create `service_account.json` via Google Cloud.
   - Attach your Google Shared Drives properly using "Content Manager" assignments.
   - Configure local environment `.env` files.

2. **[Deployment Guide](docs/2_Deployment_Guide.md)**:
   - Learn how to deploy the FastAPI backend utilizing Docker onto **Hugging Face Spaces**.
   - Instructions on scaling the React frontend across **Render.com** (including SPA rewrite fixes).

---
*Built with ❤️ by AI for streamlined human operations.*
