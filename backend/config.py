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

# OpenRouter LLM Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3.5-lightning:free")

# Pre-tested working free models on OpenRouter
FALLBACK_MODELS = [
    DEFAULT_MODEL,
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "google/gemma-4-31b-it:free",
    "liquid/lfm-2.5-2.6b:free",
    "xingchen-agi/xing4.0-29b-a4b:free",
    "recursive/flint-v1.0:free",
    "thinkingmachines/inkling:free",
]

_seen = set()
UNIQUE_FALLBACK_MODELS = []
for m in FALLBACK_MODELS:
    if m not in _seen:
        _seen.add(m)
        UNIQUE_FALLBACK_MODELS.append(m)

# JWT Auth Configuration for workspace
JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_jwt_key_phenomenon_studio_2026_xyz")
JWT_EXPIRES_IN_DAYS = 7
