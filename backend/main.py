"""Unified FastAPI backend for NLP RAG + Workspace (Auth, Chats, Tasks, Files).

Routes under /api/ serve the React frontend (auth, chats, tasks, files).
RAG routes (/api/documents, /api/rag/*) provide document ingestion and Q&A.
"""

import base64
import datetime
import hashlib
import hmac
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any

from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend import db
from backend.config import (
    DOCUMENTS_DIR,
    EMBEDDING_MODEL_NAME,
    JWT_EXPIRES_IN_DAYS,
    JWT_SECRET,
    MAX_UPLOAD_BYTES,
    SUPPORTED_EXTENSIONS,
    UNIQUE_FALLBACK_MODELS,
    VECTOR_DIMENSIONS,
)
from backend.study import study_router
from backend.models.schemas import (
    AuthResponse,
    ChatCreateRequest,
    ChatMessageRequest,
    ChatRenameRequest,
    ChunkDetail,
    ChunkSearchResult,
    Citation,
    DocumentSummary,
    RagAskRequest,
    RagAskResponse,
    SearchRequest,
    TaskCreateRequest,
    TaskUpdateRequest,
    UploadResult,
    UserLoginRequest,
    UserProfile,
    UserRegisterRequest,
)
from backend.rag import (
    chunk_document_pages,
    extract_document_pages,
    generate_embeddings,
    generate_query_embedding,
    generate_rag_answer,
    verify_api_key,
    plan_retrieval,
    check_required_facets,
    make_missing_facet_queries,
    reciprocal_rank_fusion,
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# In-memory workspace storage (demo / JWT-protected workspace)
# ---------------------------------------------------------------------------
_USERS: dict[str, dict] = {}
_CHATS: dict[str, list[dict]] = {}
_TASKS: dict[str, list[dict]] = {}


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _make_token(user_id: str) -> str:
    exp = int((datetime.datetime.utcnow() + datetime.timedelta(days=JWT_EXPIRES_IN_DAYS)).timestamp())
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url(json.dumps({"sub": user_id, "exp": exp}).encode())
    sig = _b64url(hmac.new(JWT_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"


def _decode_token(token: str) -> str:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("bad token")
        header, payload_b64, sig = parts
        expected_sig = _b64url(hmac.new(JWT_SECRET.encode(), f"{header}.{payload_b64}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected_sig):
            raise ValueError("invalid signature")
        padding = "=" * (-len(payload_b64) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload_b64 + padding))
        if data.get("exp", 0) < datetime.datetime.utcnow().timestamp():
            raise ValueError("token expired")
        return data["sub"]
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]
) -> str | None:
    if not credentials:
        return None
    try:
        return _decode_token(credentials.credentials)
    except HTTPException:
        return None


def require_user(user_id: Annotated[str | None, Depends(get_current_user_id)]) -> str:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return user_id


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(_: FastAPI):
    db.initialize_database()
    yield


app = FastAPI(
    title="NLP RAG + Workspace API",
    description=(
        "Unified backend: page-aware PDF/PPTX/DOCX RAG with exact page citations, "
        "plus workspace management (auth, chats, tasks, files)."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Study, Syllabus, Prerequisites & Exam Router
app.include_router(study_router, prefix="/api/study", tags=["Study & Exam"])



# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/health")
@app.get("/health")
def health() -> dict[str, Any]:
    active_engine = db.get_active_engine()
    llm_info = verify_api_key()
    return {
        "status": "ok",
        "database_engine": active_engine,
        "database_status": "connected",
        "embedding_model": EMBEDDING_MODEL_NAME,
        "llm_status": "configured" if llm_info.get("valid") else "needs_key",
        "llm_info": llm_info,
    }


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.post("/api/auth/register", response_model=AuthResponse)
def register(req: UserRegisterRequest) -> AuthResponse:
    user_id = str(uuid.uuid4())
    avatar = f"https://api.dicebear.com/7.x/initials/svg?seed={req.name.replace(' ', '+')}"
    user = {"id": user_id, "name": req.name, "email": req.email,
            "password": req.password, "avatar": avatar}
    _USERS[user_id] = user
    token = _make_token(user_id)
    return AuthResponse(
        token=token,
        user=UserProfile(id=user_id, name=req.name, email=req.email, avatar=avatar),
        message="Registered successfully",
    )


@app.post("/api/auth/login", response_model=AuthResponse)
def login(req: UserLoginRequest) -> AuthResponse:
    user = next(
        (u for u in _USERS.values() if u["email"] == req.email and u["password"] == req.password),
        None,
    )
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = _make_token(user["id"])
    return AuthResponse(
        token=token,
        user=UserProfile(id=user["id"], name=user["name"], email=user["email"], avatar=user["avatar"]),
        message="Logged in successfully",
    )


@app.get("/api/auth/me")
def get_me(user_id: Annotated[str, Depends(require_user)]) -> dict[str, Any]:
    user = _USERS.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"user": UserProfile(id=user["id"], name=user["name"], email=user["email"], avatar=user["avatar"])}


# ---------------------------------------------------------------------------
# Chat workspace routes
# ---------------------------------------------------------------------------

@app.get("/api/chats")
def list_chats(user_id: Annotated[str, Depends(require_user)]) -> list[dict]:
    return _CHATS.get(user_id, [])


@app.post("/api/chats", status_code=201)
def create_chat(req: ChatCreateRequest, user_id: Annotated[str, Depends(require_user)]) -> dict:
    chat = {
        "id": f"conv-{uuid.uuid4().hex[:12]}",
        "title": req.title,
        "createdAt": datetime.datetime.utcnow().isoformat(),
        "updatedAt": datetime.datetime.utcnow().isoformat(),
        "messages": [],
        "messageCount": 0,
        "lastMessage": "",
    }
    _CHATS.setdefault(user_id, []).insert(0, chat)
    return chat


@app.get("/api/chats/{chat_id}")
def get_chat(chat_id: str, user_id: Annotated[str, Depends(require_user)]) -> dict:
    chat = next((c for c in _CHATS.get(user_id, []) if c["id"] == chat_id), None)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found.")
    return chat


@app.put("/api/chats/{chat_id}")
def rename_chat(chat_id: str, req: ChatRenameRequest, user_id: Annotated[str, Depends(require_user)]) -> dict:
    chat = next((c for c in _CHATS.get(user_id, []) if c["id"] == chat_id), None)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found.")
    chat["title"] = req.title
    chat["updatedAt"] = datetime.datetime.utcnow().isoformat()
    return chat


@app.delete("/api/chats/{chat_id}")
def delete_chat(chat_id: str, user_id: Annotated[str, Depends(require_user)]) -> dict:
    chats = _CHATS.get(user_id, [])
    _CHATS[user_id] = [c for c in chats if c["id"] != chat_id]
    return {"message": "Chat deleted"}


@app.post("/api/chats/{chat_id}/messages")
def send_message(
    chat_id: str,
    req: ChatMessageRequest,
    user_id: Annotated[str, Depends(require_user)],
) -> dict:
    """Send a message in a chat. Attempts RAG answer if documents are indexed."""
    chats = _CHATS.setdefault(user_id, [])
    chat = next((c for c in chats if c["id"] == chat_id), None)
    if not chat:
        # Auto-create chat
        chat = {"id": chat_id, "title": req.text[:40], "createdAt": datetime.datetime.utcnow().isoformat(),
                "updatedAt": datetime.datetime.utcnow().isoformat(), "messages": [], "messageCount": 0, "lastMessage": ""}
        chats.insert(0, chat)

    user_msg = {
        "id": f"msg-{uuid.uuid4().hex[:8]}",
        "sender": "user",
        "text": req.text,
        "timestamp": datetime.datetime.utcnow().isoformat(),
    }
    chat["messages"].append(user_msg)

    # Try RAG answer
    ai_text = ""
    citations: list[dict] = []
    sources: list[dict] = []
    try:
        query_embedding = generate_query_embedding(req.text)
        chunks = db.search_similar_chunks(query_vector=query_embedding, top_k=4, min_similarity=0.0)
        if chunks:
            result = generate_rag_answer(query=req.text, retrieved_chunks=chunks)
            ai_text = result.get("answer", "")
            citations = result.get("citations", [])
            sources = [{"filename": c.get("filename", ""), "page_number": c.get("page_number", 1),
                        "section_title": c.get("section_title"), "similarity": c.get("similarity", 0.0)}
                       for c in chunks]
    except Exception as exc:
        logger.warning("RAG answer failed, returning fallback: %s", exc)

    if not ai_text:
        ai_text = (
            "No documents are indexed yet, or the RAG system is not configured. "
            "Please upload a document using the Documents tab and ensure your OpenRouter API key is set."
        )

    ai_msg = {
        "id": f"msg-{uuid.uuid4().hex[:8]}",
        "sender": "assistant",
        "text": ai_text,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "citations": citations,
        "sources": sources,
    }
    chat["messages"].append(ai_msg)
    chat["messageCount"] = len(chat["messages"])
    chat["lastMessage"] = ai_text[:120]
    chat["updatedAt"] = datetime.datetime.utcnow().isoformat()

    return {"userMessage": user_msg, "aiMessage": ai_msg, "chat": chat}


# ---------------------------------------------------------------------------
# Task workspace routes
# ---------------------------------------------------------------------------

@app.get("/api/tasks")
def list_tasks(user_id: Annotated[str, Depends(require_user)]) -> list[dict]:
    return _TASKS.get(user_id, [])


@app.post("/api/tasks", status_code=201)
def create_task(req: TaskCreateRequest, user_id: Annotated[str, Depends(require_user)]) -> dict:
    task = {
        "id": f"task-{uuid.uuid4().hex[:8]}",
        "title": req.title,
        "completed": False,
        "priority": req.priority,
        "createdAt": datetime.datetime.utcnow().isoformat(),
    }
    _TASKS.setdefault(user_id, []).insert(0, task)
    return task


@app.put("/api/tasks/{task_id}")
def update_task(task_id: str, req: TaskUpdateRequest, user_id: Annotated[str, Depends(require_user)]) -> dict:
    task = next((t for t in _TASKS.get(user_id, []) if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    if req.title is not None:
        task["title"] = req.title
    if req.completed is not None:
        task["completed"] = req.completed
    if req.priority is not None:
        task["priority"] = req.priority
    return task


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str, user_id: Annotated[str, Depends(require_user)]) -> dict:
    tasks = _TASKS.get(user_id, [])
    _TASKS[user_id] = [t for t in tasks if t["id"] != task_id]
    return {"message": "Task deleted"}


@app.post("/api/tasks/prioritize")
def prioritize_tasks(user_id: Annotated[str, Depends(require_user)]) -> dict:
    tasks = _TASKS.get(user_id, [])
    weights = {"high": 1, "medium": 2, "low": 3}
    sorted_tasks = sorted(tasks, key=lambda t: (t.get("completed", False), weights.get(t.get("priority", "medium"), 2)))
    _TASKS[user_id] = sorted_tasks
    return {"tasks": sorted_tasks}


# ---------------------------------------------------------------------------
# Files workspace route (list indexed documents as "files")
# ---------------------------------------------------------------------------

@app.get("/api/files")
def list_files() -> list[dict]:
    """Return indexed RAG documents as workspace files."""
    docs = db.list_documents()
    return [
        {
            "id": str(d["id"]),
            "name": d["filename"],
            "size": f"{d['chunk_count']} chunks",
            "type": d["source_type"],
            "updatedAt": str(d.get("created_at", "")),
        }
        for d in docs
    ]


# ---------------------------------------------------------------------------
# Document RAG routes
# ---------------------------------------------------------------------------

def _process_and_store_document(filename: str, content: bytes) -> UploadResult:
    """Page-aware document processing and vector indexing."""
    extension = os.path.splitext(filename)[1].lower()
    pages, source_units, unit_type = extract_document_pages(filename, content)
    document_id = uuid.uuid4()

    total_chars = sum(p.char_count for p in pages)
    if total_chars == 0:
        raise HTTPException(
            status_code=422,
            detail="No readable text was found. Scanned PDFs need OCR before upload.",
        )

    chunk_records = chunk_document_pages(
        pages=pages, document_id=str(document_id), document_name=filename,
    )
    if not chunk_records:
        raise HTTPException(status_code=422, detail="No readable text was found. Scanned PDFs need OCR before upload.")

    import numpy as np
    chunks_text = [c["content"] for c in chunk_records]
    embeddings = generate_embeddings(chunks_text)
    if embeddings.shape != (len(chunks_text), VECTOR_DIMENSIONS):
        raise HTTPException(status_code=500, detail="The embedding model returned an invalid vector.")

    created_at = db.save_document(
        doc_id=document_id, filename=filename, source_type=extension[1:],
        source_units=source_units, unit_type=unit_type,
        embedding_model=EMBEDDING_MODEL_NAME, chunks=chunks_text,
        embeddings=embeddings, chunk_metadata=chunk_records, file_bytes=content,
    )

    return UploadResult(
        id=document_id, filename=filename, source_type=extension[1:],
        source_units=source_units, unit_type=unit_type, chunk_count=len(chunks_text),
        created_at=str(created_at),
        message="Document extracted page-by-page, embedded, and stored successfully.",
    )


@app.post("/api/documents", response_model=UploadResult, status_code=201)
@app.post("/documents", response_model=UploadResult, status_code=201)
def upload_document(file: Annotated[UploadFile, File()]) -> UploadResult:
    filename = file.filename or ""
    extension = os.path.splitext(filename)[1].lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Supported file types are PDF, PPTX, and DOCX.")
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Files must be 25 MB or smaller.")
    if not content:
        raise HTTPException(status_code=422, detail="The uploaded file is empty.")
    return _process_and_store_document(filename, content)


@app.post("/api/documents/index-workspace")
@app.post("/documents/index-workspace")
def index_workspace_documents() -> dict[str, Any]:
    """Scan the project directory for existing PDFs and index them."""
    workspace_path = Path(".")
    existing_docs = {d["filename"] for d in db.list_documents()}
    indexed, skipped, errors = [], [], []
    for file_path in workspace_path.iterdir():
        if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
            filename = file_path.name
            if filename in existing_docs:
                skipped.append(filename)
                continue
            try:
                content = file_path.read_bytes()
                result = _process_and_store_document(filename, content)
                indexed.append({"filename": filename, "id": str(result.id),
                                 "chunks": result.chunk_count, "units": result.source_units})
            except Exception as exc:
                logger.error("Failed to index %s: %s", filename, exc)
                errors.append({"filename": filename, "error": str(exc)})
    return {"indexed_count": len(indexed), "indexed": indexed, "skipped": skipped, "errors": errors}


@app.get("/api/documents", response_model=list[DocumentSummary])
@app.get("/documents", response_model=list[DocumentSummary])
def list_documents() -> list[DocumentSummary]:
    docs = db.list_documents()
    return [
        DocumentSummary(
            id=uuid.UUID(str(d["id"])), filename=d["filename"], source_type=d["source_type"],
            source_units=d["source_units"], unit_type=d["unit_type"],
            chunk_count=d["chunk_count"], created_at=str(d["created_at"]),
            storage_key=d.get("storage_key"),
        )
        for d in docs
    ]


@app.delete("/api/documents/{document_id}")
@app.delete("/documents/{document_id}")
def delete_document(document_id: uuid.UUID) -> dict[str, str]:
    success = db.delete_document(document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"message": "Document deleted successfully."}


@app.get("/api/documents/{document_id}/file")
@app.get("/documents/{document_id}/file")
def get_document_file(document_id: uuid.UUID) -> FileResponse:
    """Serve the original document file for in-browser PDF viewing."""
    doc = db.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    file_path = db.get_document_file_path(document_id)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Original document file not found on disk.")
    ext = file_path.suffix.lower()
    media_type = "application/pdf"
    if ext == ".pptx":
        media_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    elif ext == ".docx":
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return FileResponse(
        path=str(file_path), media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{doc["filename"]}"', "Accept-Ranges": "bytes"},
    )


@app.get("/api/documents/{document_id}/pages/{page_number}")
@app.get("/documents/{document_id}/pages/{page_number}")
def get_page_info(document_id: uuid.UUID, page_number: int) -> dict[str, Any]:
    doc = db.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    if page_number < 1 or page_number > doc["source_units"]:
        raise HTTPException(status_code=422,
                            detail=f"Invalid page {page_number}. Document has {doc['source_units']} {doc['unit_type']}.")
    info = db.get_page_metadata(document_id, page_number)
    if not info:
        raise HTTPException(status_code=404, detail="Page metadata not available.")
    return info


@app.get("/api/documents/{document_id}/chunks", response_model=list[ChunkDetail])
@app.get("/documents/{document_id}/chunks", response_model=list[ChunkDetail])
def list_document_chunks(document_id: uuid.UUID, limit: int = 5, offset: int = 0) -> list[ChunkDetail]:
    if not 1 <= limit <= 50:
        raise HTTPException(status_code=422, detail="Limit must be between 1 and 50.")
    if offset < 0:
        raise HTTPException(status_code=422, detail="Offset cannot be negative.")
    chunks = db.get_document_chunks(document_id, limit=limit, offset=offset)
    return [
        ChunkDetail(
            chunk_index=c["chunk_index"], content=c["content"], embedding=c["embedding"],
            page_number=c.get("page_number", 1) or 1, page_end=c.get("page_end", 1) or 1,
            section_title=c.get("section_title"),
            start_char=c.get("start_char", 0) or 0,
            end_char=c.get("end_char", len(c["content"])) or len(c["content"]),
        )
        for c in chunks
    ]


# ---------------------------------------------------------------------------
# RAG search and Q&A
# ---------------------------------------------------------------------------

@app.post("/api/rag/search", response_model=list[ChunkSearchResult])
@app.post("/rag/search", response_model=list[ChunkSearchResult])
def search_chunks(req: SearchRequest) -> list[ChunkSearchResult]:
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Search query cannot be empty.")
    query_embedding = generate_query_embedding(query)
    matching_chunks = db.search_similar_chunks(
        query_vector=query_embedding, top_k=req.top_k,
        document_id=req.document_id, min_similarity=req.min_similarity,
    )
    return [
        ChunkSearchResult(
            chunk_id=c["chunk_id"], document_id=str(c["document_id"]), filename=c["filename"],
            chunk_index=c["chunk_index"], content=c["content"], similarity=c["similarity"],
            page_number=c.get("page_number", 1) or 1, page_end=c.get("page_end", 1) or 1,
            section_title=c.get("section_title"),
            start_char=c.get("start_char", 0) or 0,
            end_char=c.get("end_char", len(c["content"])) or len(c["content"]),
        )
        for c in matching_chunks
    ]


@app.post("/api/rag/ask", response_model=RagAskResponse)
@app.post("/rag/ask", response_model=RagAskResponse)
def ask_question(req: RagAskRequest) -> RagAskResponse:
    """Answer questions using RAG: Vector retrieval + grounded LLM + verified citations."""
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Question cannot be empty.")

    question_plan = plan_retrieval(query)
    query_embeddings = generate_embeddings(question_plan.queries)
    retrieval_sets = [
        db.search_similar_chunks(
            query_vector=query_embedding,
            top_k=max(req.top_k, 4),
            document_id=req.document_id,
            min_similarity=0.0,
        )
        for query_embedding in query_embeddings
    ]
    matching_chunks = reciprocal_rank_fusion(retrieval_sets)[:req.top_k]
    evidence_check = check_required_facets(question_plan.required_facets, matching_chunks)
    retry_queries: list[str] = []
    if evidence_check["missing"]:
        retry_queries = make_missing_facet_queries(query, evidence_check["missing"])
        if retry_queries:
            retry_embeddings = generate_embeddings(retry_queries)
            retry_sets = [db.search_similar_chunks(
                query_vector=retry_embedding, top_k=max(req.top_k, 4),
                document_id=req.document_id, min_similarity=0.0,
            ) for retry_embedding in retry_embeddings]
            matching_chunks = reciprocal_rank_fusion(retrieval_sets + retry_sets)[:req.top_k]
            evidence_check = check_required_facets(question_plan.required_facets, matching_chunks)
    question_metadata = question_plan.to_dict()
    question_metadata["evidence_check"] = evidence_check
    question_metadata["retry_queries"] = retry_queries

    best_similarity = max((float(chunk.get("similarity", 0.0)) for chunk in matching_chunks), default=-1.0)
    if not matching_chunks or best_similarity < 0.20:
        return RagAskResponse(
            query=query, answer="The provided document does not contain this information.",
            model_used="none", chunks_used=0, sources=[], citations=[],
            question_plan=question_metadata,
        )

    try:
        llm_result = generate_rag_answer(
            query=query, retrieved_chunks=matching_chunks,
            model=req.model, api_key=req.api_key, temperature=req.temperature,
            question_labels=question_plan.labels,
            required_facets=question_plan.required_facets,
            missing_facets=evidence_check["missing"],
        )
    except Exception as exc:
        logger.error("LLM generation failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"LLM generation failed: {exc}")

    sources = [
        ChunkSearchResult(
            chunk_id=c["chunk_id"], document_id=str(c["document_id"]), filename=c["filename"],
            chunk_index=c["chunk_index"], content=c["content"], similarity=c["similarity"],
            page_number=c.get("page_number", 1) or 1, page_end=c.get("page_end", 1) or 1,
            section_title=c.get("section_title"),
            start_char=c.get("start_char", 0) or 0,
            end_char=c.get("end_char", len(c["content"])) or len(c["content"]),
        )
        for c in matching_chunks
    ]
    citations = [Citation(**cite) for cite in llm_result.get("citations", [])]

    return RagAskResponse(
        query=query, answer=llm_result["answer"], model_used=llm_result["model_used"],
        chunks_used=llm_result["chunks_used"], sources=sources, citations=citations,
        prompt_tokens=llm_result.get("prompt_tokens", 0),
        completion_tokens=llm_result.get("completion_tokens", 0),
        total_tokens=llm_result.get("total_tokens", 0),
        question_plan=question_metadata,
    )


@app.get("/api/rag/models")
@app.get("/rag/models")
def list_available_models() -> dict[str, Any]:
    from backend.config import DEFAULT_MODEL
    return {"default": DEFAULT_MODEL, "recommended_free_models": UNIQUE_FALLBACK_MODELS}
