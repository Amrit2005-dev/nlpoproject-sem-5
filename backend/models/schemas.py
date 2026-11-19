"""Pydantic schemas and data models for RAG, Document processing, and Workspace API."""

from typing import Any
import uuid
from pydantic import BaseModel, Field


# ==========================================
# DOCUMENT & CHUNK SCHEMAS
# ==========================================

class DocumentSummary(BaseModel):
    id: uuid.UUID
    filename: str
    source_type: str
    source_units: int
    unit_type: str
    chunk_count: int
    created_at: str
    storage_key: str | None = None


class UploadResult(DocumentSummary):
    message: str


class ChunkDetail(BaseModel):
    chunk_index: int
    content: str
    embedding: list[float]
    page_number: int = 1
    page_end: int = 1
    section_title: str | None = None
    start_char: int = 0
    end_char: int = 0


class ChunkSearchResult(BaseModel):
    chunk_id: int | str
    document_id: str
    filename: str
    chunk_index: int
    content: str
    similarity: float
    page_number: int = 1
    page_end: int = 1
    section_title: str | None = None
    start_char: int = 0
    end_char: int = 0


class Citation(BaseModel):
    citation_id: str
    chunk_id: int | str
    document_id: str
    document_name: str
    page_number: int
    page_end: int
    section_title: str | None = None
    quoted_text: str
    start_char: int | None = None
    end_char: int | None = None
    open_url: str


class PageMetadataResponse(BaseModel):
    document_id: str
    filename: str
    page_number: int
    total_pages: int
    unit_type: str
    chunk_count: int
    section_titles: list[str]
    file_url: str


# ==========================================
# RAG SEARCH & ASK SCHEMAS
# ==========================================

class SearchRequest(BaseModel):
    query: str = Field(..., description="User search query to embed and match against document vectors")
    document_id: uuid.UUID | None = Field(None, description="Optional document ID to restrict search")
    top_k: int = Field(5, ge=1, le=20, description="Number of most similar chunks to return")
    min_similarity: float = Field(0.0, ge=-1.0, le=1.0, description="Minimum cosine similarity threshold")


class ConversationMessage(BaseModel):
    sender: str = "user"
    text: str


class RagAskRequest(BaseModel):
    query: str = Field(..., description="Question to answer based on the stored documents")
    document_id: uuid.UUID | None = Field(None, description="Optional document ID to restrict context")
    conversation_history: list[ConversationMessage] = Field(
        default_factory=list,
        description="Recent conversation messages used to resolve follow-up questions",
    )
    top_k: int = Field(4, ge=1, le=10, description="Number of retrieved chunks used as LLM context")
    model: str | None = Field(None, description="Optional Google Gemini model name")
    api_key: str | None = Field(None, description="Optional Google Gemini API key override")
    temperature: float = Field(0.1, ge=0.0, le=1.0, description="Sampling temperature")
    language_override: str | None = Field(None, description="Optional language mode override")


class RagAskResponse(BaseModel):
    query: str
    answer: str
    model_used: str
    chunks_used: int
    sources: list[ChunkSearchResult]
    citations: list[Citation] = []
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    question_plan: dict[str, Any] | None = None
    language_detection: dict[str, Any] | None = None


# ==========================================
# WORKSPACE & AUTH SCHEMAS (React Frontend)
# ==========================================

class UserLoginRequest(BaseModel):
    email: str
    password: str


class UserRegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    avatar: str


class AuthResponse(BaseModel):
    token: str
    user: UserProfile
    message: str = "Authenticated successfully"


class ChatCreateRequest(BaseModel):
    title: str = "New Chat"


class ChatRenameRequest(BaseModel):
    title: str


class ChatMessageRequest(BaseModel):
    text: str
    language_override: str | None = None


class TaskCreateRequest(BaseModel):
    title: str
    priority: str = "medium"


class TaskUpdateRequest(BaseModel):
    title: str | None = None
    completed: bool | None = None
    priority: str | None = None
