import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.api import jd, screening, test, auth, dashboard, interview

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Unified API for Hiring System V2",
)

# CORS Middleware (Allow React Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(jd.router)
app.include_router(screening.router)
app.include_router(test.router)
app.include_router(dashboard.router)
app.include_router(interview.router)

@app.on_event("startup")
async def startup_event():
    from app.graph.pipeline import sync_all_from_sheets
    sync_all_from_sheets()

# Mount static directories
os.makedirs("Reports", exist_ok=True)
os.makedirs("data/resumes", exist_ok=True)

app.mount("/reports", StaticFiles(directory="Reports"), name="reports")

@app.get("/")
async def root():
    return {"message": "Welcome to Recruiting AI API v2"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
