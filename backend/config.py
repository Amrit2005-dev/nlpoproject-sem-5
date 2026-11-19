"""Centralized configuration module for the NLP Document Vector Store & RAG backend."""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DOCUMENTS_DIR = Path(os.getenv("DOCUMENTS_DIR", str(DATA_DIR / "documents")))
DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)

# Database
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5434/vectordb"
)
SQLITE_DB_PATH = os.getenv("SQLITE_DB_PATH", str(DATA_DIR / "vectordb.sqlite"))

# Embedding Model
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
VECTOR_DIMENSIONS = 1024

# Upload limits
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB
SUPPORTED_EXTENSIONS = {".pdf", ".pptx", ".docx"}

# Google Gemini API configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_BASE_URL = os.getenv(
    "GEMINI_BASE_URL",
    "https://generativelanguage.googleapis.com/v1beta",
)
DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
UNIQUE_FALLBACK_MODELS = [DEFAULT_MODEL]

# JWT Auth Configuration for workspace
JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_jwt_key_phenomenon_studio_2026_xyz")
JWT_EXPIRES_IN_DAYS = 7
