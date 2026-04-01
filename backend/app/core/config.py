"""
Core Configuration - Hiring System V2
Centralized settings management using Pydantic BaseSettings.
"""

import os
import configparser
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

# Load .env from project root
_root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_env_path = os.path.join(_root_dir, ".env")

# Force-load so os.getenv fallback works just in case
if os.path.exists(_env_path):
    load_dotenv(_env_path, override=True)

class Settings(BaseSettings):
    """Application settings loaded from environment variables and config files."""
    
    model_config = SettingsConfigDict(env_file=_env_path, extra="ignore", env_file_encoding="utf-8")

    # ── App ──────────────────────────────────────────────
    app_name: str = "RecruitAI Hiring System V2"
    version: str = "2.0.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    base_url: str = os.getenv("BASE_URL", "http://localhost:8000")

    # ── API Keys ─────────────────────────────────────────
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    huggingface_api_token: str = os.getenv("HUGGINGFACE_API_TOKEN", "")

    # ── LLM Configuration ────────────────────────────────
    llm_model: str = "gpt-4o"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 1500

    # ── Embedding Configuration ──────────────────────────
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    chunk_size: int = 1000
    chunk_overlap: int = 100

    # ── Scoring Weights ──────────────────────────────────
    keyword_weight: int = 25
    experience_weight: int = 20
    education_weight: int = 10
    location_weight: int = 10
    text_format_weight: int = 5
    visual_weight: int = 30

    # ── Thresholds ───────────────────────────────────────
    visual_threshold: float = 40.0
    text_max_score: int = 70
    role_match_threshold: float = 0.45
    semantic_skill_threshold: float = 0.45
    top_candidates: int = 10

    # ── Feature Flags ────────────────────────────────────
    enable_anonymization: bool = True
    enable_visual_analysis: bool = True
    enable_semantic_search: bool = True
    enable_skill_exp_mapping: bool = True
    enable_project_complexity: bool = True

    # ── Paths ────────────────────────────────────────────
    data_dir: str = "data"
    resume_dir: str = "data/resumes"
    db_persist_dir: str = "chroma_db"
    reports_dir: str = "Reports"
    temp_dir: str = "temp"

    # ── SMTP Configuration ───────────────────────────────
    smtp_server: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")

    # ── WhatsApp Cloud API Configuration ─────────────────
    whatsapp_enabled: bool = os.getenv("WHATSAPP_ENABLED", "false").lower() == "true"
    whatsapp_access_token: str = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    whatsapp_phone_number_id: str = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    whatsapp_api_version: str = os.getenv("WHATSAPP_API_VERSION", "v18.0")
    whatsapp_template_name: str = os.getenv("WHATSAPP_TEMPLATE_NAME", "")
    whatsapp_template_lang: str = os.getenv("WHATSAPP_TEMPLATE_LANG", "en")
    whatsapp_country_code: str = os.getenv("WHATSAPP_COUNTRY_CODE", "91")
    whatsapp_send_timeout: int = int(os.getenv("WHATSAPP_SEND_TIMEOUT", "20"))
    whatsapp_send_gap_seconds: float = float(os.getenv("WHATSAPP_SEND_GAP_SECONDS", "2"))
    whatsapp_webhook_verify_token: str = os.getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "")

    # ── Google Services ──────────────────────────────────
    google_spreadsheet_id: str = os.getenv("GOOGLE_SPREADSHEET_ID", "")
    google_drive_folder_id: str = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")
    service_account_file: str = os.getenv("SERVICE_ACCOUNT_FILE", "service_account.json")
    gmail_client_secret_file: str = os.getenv(
        "GMAIL_CLIENT_SECRET_FILE",
        os.getenv("GMAIL_CLIENT_SECRET", "client_secret.json"),
    )



    def load_from_ini(self, ini_path: str):
        """Load settings overrides from config.ini file."""
        if not os.path.exists(ini_path):
            return

        config = configparser.ConfigParser()
        config.read(ini_path, encoding="utf-8")

        if "scoring" in config:
            self.keyword_weight = config.getint("scoring", "keyword_match_weight", fallback=self.keyword_weight)
            self.experience_weight = config.getint("scoring", "experience_weight", fallback=self.experience_weight)
            self.education_weight = config.getint("scoring", "education_weight", fallback=self.education_weight)
            self.text_format_weight = config.getint("scoring", "text_format_weight", fallback=self.text_format_weight)
            self.visual_weight = config.getint("scoring", "visual_analysis_weight", fallback=self.visual_weight)
            self.location_weight = config.getint("scoring", "location_weight", fallback=self.location_weight)

        if "search" in config:
            self.top_candidates = config.getint("search", "top_candidates", fallback=self.top_candidates)

        if "embeddings" in config:
            self.embedding_model = config.get("embeddings", "model_name", fallback=self.embedding_model)

        if "llm" in config:
            self.llm_model = config.get("llm", "model", fallback=self.llm_model)
            self.llm_temperature = config.getfloat("llm", "temperature", fallback=self.llm_temperature)

        if "advanced" in config:
            self.enable_anonymization = config.getboolean("advanced", "enable_anonymization", fallback=self.enable_anonymization)


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings singleton."""
    settings = Settings()

    # Try loading config.ini from various locations
    for path in ["config.ini", "../config.ini", "../../config.ini"]:
        if os.path.exists(path):
            settings.load_from_ini(path)
            break

    return settings
