"""
AI Hiring Pipeline System v2
Main FastAPI Application Entry Point
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.api.routes import jd, screening, candidates, test, auth, dashboard

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("app.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("HiringPipeline")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events"""
    # Startup
    logger.info("🚀 AI Hiring Pipeline System v2 Starting...")
    
    # Create required directories
    os.makedirs(settings.reports_dir, exist_ok=True)
    os.makedirs(settings.chroma_persist_dir, exist_ok=True)
    os.makedirs("tokens", exist_ok=True)
    
    logger.info(f"✅ Reports directory: {settings.reports_dir}")
    logger.info(f"✅ ChromaDB directory: {settings.chroma_persist_dir}")
    
    yield
    
    # Shutdown
    logger.info("👋 AI Hiring Pipeline System v2 Shutting down...")


# Create FastAPI application
app = FastAPI(
    title="AI Hiring Pipeline System",
    description="Production-ready AI-powered recruitment pipeline with JD generation, resume screening, and aptitude testing",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for reports
os.makedirs(settings.reports_dir, exist_ok=True)
app.mount("/reports", StaticFiles(directory=settings.reports_dir), name="reports")

# Include API routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(jd.router, prefix="/jd", tags=["Job Description"])
app.include_router(screening.router, prefix="/screening", tags=["Resume Screening"])
app.include_router(candidates.router, prefix="/candidates", tags=["Candidates"])
app.include_router(test.router, prefix="/test", tags=["Aptitude Test"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "AI Hiring Pipeline System v2",
        "version": "2.0.0"
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "openai_configured": bool(settings.openai_api_key),
        "sheets_configured": bool(settings.google_sheet_id),
        "gmail_configured": os.path.exists(settings.gmail_client_secret)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
