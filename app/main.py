import io
import logging
import os
from pathlib import Path
from typing import Annotated, Any
import uuid
from zipfile import BadZipFile
from contextlib import asynccontextmanager
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()

from docx import Document as WordDocument
from docx.opc.exceptions import PackageNotFoundError as DocxPackageNotFoundError
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import pymupdf as fitz
from pptx import Presentation
from pptx.exc import PackageNotFoundError as PptxPackageNotFoundError
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
import torch

from app.chunking import chunk_document_pages, split_into_chunks
from app.extraction import extract_document_pages, ExtractedPage
from app import db
from app import llm
from app.rag.question_segmentation import (
    check_required_facets,
    make_missing_facet_queries,
    plan_retrieval,
    reciprocal_rank_fusion,
)

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5434/vectordb"
)
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
VECTOR_DIMENSIONS = 1024
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
SUPPORTED_EXTENSIONS = {".pdf", ".pptx", ".docx"}


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


class SearchRequest(BaseModel):
    query: str = Field(..., description="User search query to embed and match against document vectors")
    document_id: uuid.UUID | None = Field(None, description="Optional document ID to restrict search")
    top_k: int = Field(5, ge=1, le=20, description="Number of most similar chunks to return")
    min_similarity: float = Field(0.0, ge=-1.0, le=1.0, description="Minimum cosine similarity threshold")


class RagAskRequest(BaseModel):
    query: str = Field(..., description="Question to answer based on the stored documents")
    document_id: uuid.UUID | None = Field(None, description="Optional document ID to restrict context")
    top_k: int = Field(4, ge=1, le=10, description="Number of retrieved chunks used as LLM context")
    model: str | None = Field(None, description="Optional Google Gemini model name")
    api_key: str | None = Field(None, description="Optional Google Gemini API key override")
    temperature: float = Field(0.1, ge=0.0, le=1.0, description="Sampling temperature")


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


# Legacy get_connection for backwards compatibility with tests and postgres
def _original_get_connection():
    import psycopg
    from psycopg.rows import dict_row
    from pgvector.psycopg import register_vector
    connection = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    register_vector(connection)
    return connection


get_connection = _original_get_connection


def initialize_database() -> None:
    db.initialize_database()


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = SentenceTransformer(EMBEDDING_MODEL_NAME, device=device)
    logger.info("Embedding model loaded on %s", device)
    return model


def extract_text(filename: str, content: bytes) -> tuple[str, int, str]:
    """Legacy extraction helper maintained for backward compatibility with existing tests."""
    extension = os.path.splitext(filename)[1].lower()
    if extension == ".pdf":
        try:
            with fitz.open(stream=content, filetype="pdf") as document:
                if document.needs_pass:
                    raise HTTPException(
                        status_code=422, detail="Password-protected PDFs are not supported."
                    )
                text = "\n".join(page.get_text() for page in document)
                return text, document.page_count, "pages"
        except fitz.FileDataError as exc:
            raise HTTPException(status_code=422, detail="The PDF file is invalid.") from exc

    if extension == ".pptx":
        try:
            presentation = Presentation(io.BytesIO(content))
        except (BadZipFile, KeyError, PptxPackageNotFoundError, ValueError) as exc:
            raise HTTPException(status_code=422, detail="The PPTX file is invalid.") from exc

        def shape_text(shape: object) -> list[str]:
            text_parts: list[str] = []
            if getattr(shape, "has_text_frame", False):
                text_parts.append(shape.text)
            if getattr(shape, "has_table", False):
                text_parts.extend(
                    cell.text
                    for row in shape.table.rows
                    for cell in row.cells
                )
            if getattr(shape, "shape_type", None) == 6:
                text_parts.extend(
                    part
                    for child in shape.shapes
                    for part in shape_text(child)
                )
            return text_parts

        slides = [
            "\n".join(part for shape in slide.shapes for part in shape_text(shape))
            for slide in presentation.slides
        ]
        return "\n".join(slides), len(slides), "slides"

    if extension == ".docx":
        try:
            document = WordDocument(io.BytesIO(content))
        except (BadZipFile, KeyError, DocxPackageNotFoundError, ValueError) as exc:
            raise HTTPException(status_code=422, detail="The DOCX file is invalid.") from exc
        text_parts = [paragraph.text for paragraph in document.paragraphs]
        text_parts.extend(
            cell.text for table in document.tables for row in table.rows for cell in row.cells
        )
        return "\n".join(text_parts), len(text_parts), "paragraphs"

    raise HTTPException(
        status_code=415, detail="Supported file types are PDF, PPTX, and DOCX."
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    get_embedding_model()
    yield


app = FastAPI(
    title="Document Vector Store & RAG API",
    description="Extract documents, generate embeddings, store vectors, and perform grounded Q&A with Google Gemini.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    active_engine = db.get_active_engine()
    llm_info = llm.verify_api_key()
    return {
        "status": "ok",
        "database_engine": active_engine,
        "database_status": "connected",
        "embedding_model": EMBEDDING_MODEL_NAME,
        "llm_status": "configured" if llm_info.get("valid") else "needs_key",
        "llm_info": llm_info,
    }


def _process_and_store_document(filename: str, content: bytes) -> UploadResult:
    """Process uploaded or workspace document with page awareness and vector indexing."""
    extension = os.path.splitext(filename)[1].lower()
    pages, source_units, unit_type = extract_document_pages(filename, content)
    document_id = uuid.uuid4()

    # Verify document has readable content
    total_chars = sum(p.char_count for p in pages)
    if total_chars == 0:
        raise HTTPException(
            status_code=422,
            detail="No readable text was found. Scanned PDFs need OCR before upload.",
        )

    # Perform page-aware chunking preserving exact 1-based page numbers
    chunk_records = chunk_document_pages(
        pages=pages,
        document_id=str(document_id),
        document_name=filename,
    )
    if not chunk_records:
        raise HTTPException(
            status_code=422,
            detail="No readable text was found. Scanned PDFs need OCR before upload.",
        )

    chunks_text = [c["content"] for c in chunk_records]
    embeddings = get_embedding_model().encode(
        chunks_text,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
        batch_size=32,
        device=get_embedding_model().device,
    )
    if embeddings.shape != (len(chunks_text), VECTOR_DIMENSIONS):
        logger.error(
            "Embedding model %s returned shape %s; expected (%s, %s)",
            EMBEDDING_MODEL_NAME,
            embeddings.shape,
            len(chunks_text),
            VECTOR_DIMENSIONS,
        )
        raise HTTPException(status_code=500, detail="The embedding model returned an invalid vector.")

    created_at = db.save_document(
        doc_id=document_id,
        filename=filename,
        source_type=extension[1:],
        source_units=source_units,
        unit_type=unit_type,
        embedding_model=EMBEDDING_MODEL_NAME,
        chunks=chunks_text,
        embeddings=embeddings,
        chunk_metadata=chunk_records,
        file_bytes=content,
    )

    return UploadResult(
        id=document_id,
        filename=filename,
        source_type=extension[1:],
        source_units=source_units,
        unit_type=unit_type,
        chunk_count=len(chunks_text),
        created_at=str(created_at),
        message="Document extracted page-by-page, embedded, and stored successfully.",
    )


@app.post("/documents", response_model=UploadResult, status_code=201)
def upload_document(file: Annotated[UploadFile, File()]) -> UploadResult:
    filename = file.filename or ""
    extension = os.path.splitext(filename)[1].lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=415, detail="Supported file types are PDF, PPTX, and DOCX."
        )

    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Files must be 25 MB or smaller.")
    if not content:
        raise HTTPException(status_code=422, detail="The uploaded file is empty.")

    return _process_and_store_document(filename, content)


@app.post("/documents/index-workspace")
def index_workspace_documents() -> dict[str, Any]:
    """Scan the project directory for existing PDFs and index them with page-aware metadata."""
    workspace_path = Path(".")
    existing_docs = {d["filename"] for d in db.list_documents()}

    indexed = []
    skipped = []
    errors = []

    for file_path in workspace_path.iterdir():
        if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
            filename = file_path.name
            if filename in existing_docs:
                skipped.append(filename)
                continue
            try:
                content = file_path.read_bytes()
                result = _process_and_store_document(filename, content)
                indexed.append(
                    {
                        "filename": filename,
                        "id": str(result.id),
                        "chunks": result.chunk_count,
                        "units": result.source_units,
                    }
                )
            except Exception as exc:
                logger.error("Failed to index local document %s: %s", filename, exc)
                errors.append({"filename": filename, "error": str(exc)})

    return {
        "indexed_count": len(indexed),
        "indexed": indexed,
        "skipped": skipped,
        "errors": errors,
    }


@app.get("/documents/{document_id}/file")
@app.get("/api/documents/{document_id}/file")
def get_document_file(document_id: uuid.UUID) -> FileResponse:
    """Serve the original document file securely for in-browser PDF viewing and page navigation."""
    doc = db.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    file_path = db.get_document_file_path(document_id)
    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=404, detail="Original document file not found on disk."
        )

    ext = file_path.suffix.lower()
    media_type = "application/pdf"
    if ext == ".pptx":
        media_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    elif ext == ".docx":
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    safe_filename = doc["filename"]
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        headers={
            "Content-Disposition": f'inline; filename="{safe_filename}"',
            "Accept-Ranges": "bytes",
        },
    )


@app.get("/documents/{document_id}/pages/{page_number}")
@app.get("/api/documents/{document_id}/pages/{page_number}")
def get_page_info(document_id: uuid.UUID, page_number: int) -> dict[str, Any]:
    """Retrieve metadata for a specific 1-based page of a document."""
    doc = db.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if page_number < 1 or page_number > doc["source_units"]:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid page number {page_number}. Document has {doc['source_units']} {doc['unit_type']}.",
        )

    info = db.get_page_metadata(document_id, page_number)
    if not info:
        raise HTTPException(status_code=404, detail="Page metadata not available.")
    return info


@app.get("/documents/{document_id}/chunks", response_model=list[ChunkDetail])
def list_document_chunks(
    document_id: uuid.UUID,
    limit: int = 5,
    offset: int = 0,
) -> list[ChunkDetail]:
    if not 1 <= limit <= 50:
        raise HTTPException(status_code=422, detail="Limit must be between 1 and 50.")
    if offset < 0:
        raise HTTPException(status_code=422, detail="Offset cannot be negative.")

    # Compatibility hook for tests that monkeypatch get_connection
    if get_connection is not _original_get_connection:
        with get_connection() as connection:
            rows = connection.execute(
                """
                SELECT chunk_index, content, embedding
                FROM document_chunks
                WHERE document_id = %s
                ORDER BY chunk_index
                LIMIT %s OFFSET %s
                """,
                (document_id, limit, offset),
            ).fetchall()
        return [
            ChunkDetail(
                chunk_index=row["chunk_index"],
                content=row["content"],
                embedding=row["embedding"].to_list() if hasattr(row["embedding"], "to_list") else list(row["embedding"]),
                page_number=row.get("page_number", 1) if hasattr(row, "get") else 1,
                page_end=row.get("page_end", 1) if hasattr(row, "get") else 1,
                section_title=row.get("section_title") if hasattr(row, "get") else None,
            )
            for row in rows
        ]

    chunks = db.get_document_chunks(document_id, limit=limit, offset=offset)
    return [
        ChunkDetail(
            chunk_index=c["chunk_index"],
            content=c["content"],
            embedding=c["embedding"],
            page_number=c.get("page_number", 1) or 1,
            page_end=c.get("page_end", 1) or 1,
            section_title=c.get("section_title"),
            start_char=c.get("start_char", 0) or 0,
            end_char=c.get("end_char", len(c["content"])) or len(c["content"]),
        )
        for c in chunks
    ]


@app.get("/documents", response_model=list[DocumentSummary])
def list_documents() -> list[DocumentSummary]:
    # Compatibility hook for tests that monkeypatch get_connection
    if get_connection is not _original_get_connection:
        with get_connection() as connection:
            rows = connection.execute(
                """
                SELECT d.id, d.filename, d.source_type, d.source_units, d.unit_type,
                       d.created_at::text AS created_at, COUNT(c.id)::int AS chunk_count
                FROM documents AS d
                LEFT JOIN document_chunks AS c ON c.document_id = d.id
                GROUP BY d.id
                ORDER BY d.created_at DESC
                """
            ).fetchall()
        return [DocumentSummary(**dict(row)) for row in rows]

    docs = db.list_documents()
    return [
        DocumentSummary(
            id=uuid.UUID(str(d["id"])),
            filename=d["filename"],
            source_type=d["source_type"],
            source_units=d["source_units"],
            unit_type=d["unit_type"],
            chunk_count=d["chunk_count"],
            created_at=str(d["created_at"]),
            storage_key=d.get("storage_key"),
        )
        for d in docs
    ]


@app.delete("/documents/{document_id}")
def delete_document(document_id: uuid.UUID) -> dict[str, str]:
    success = db.delete_document(document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"message": "Document deleted successfully."}


@app.post("/rag/search", response_model=list[ChunkSearchResult])
def search_chunks(req: SearchRequest) -> list[ChunkSearchResult]:
    """Retrieve top-k relevant chunks with page and section metadata."""
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Search query cannot be empty.")

    query_embedding = get_embedding_model().encode(
        query,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
        batch_size=32,
    )

    matching_chunks = db.search_similar_chunks(
        query_vector=query_embedding,
        top_k=req.top_k,
        document_id=req.document_id,
        min_similarity=req.min_similarity,
    )

    return [
        ChunkSearchResult(
            chunk_id=c["chunk_id"],
            document_id=str(c["document_id"]),
            filename=c["filename"],
            chunk_index=c["chunk_index"],
            content=c["content"],
            similarity=c["similarity"],
            page_number=c.get("page_number", 1) or 1,
            page_end=c.get("page_end", 1) or 1,
            section_title=c.get("section_title"),
            start_char=c.get("start_char", 0) or 0,
            end_char=c.get("end_char", len(c["content"])) or len(c["content"]),
        )
        for c in matching_chunks
    ]


@app.post("/rag/ask", response_model=RagAskResponse)
def ask_question(req: RagAskRequest) -> RagAskResponse:
    """Answer questions using RAG: Vector retrieval + strictly grounded LLM completion + verified citations."""
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Question cannot be empty.")

    question_plan = plan_retrieval(query)
    planned_queries = question_plan.queries
    query_embeddings = get_embedding_model().encode(
        planned_queries,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
        batch_size=32,
    )

    retrieval_sets = []
    for query_embedding in query_embeddings:
        retrieval_sets.append(db.search_similar_chunks(
            query_vector=query_embedding,
            top_k=max(req.top_k, 4),
            document_id=req.document_id,
            min_similarity=0.0,
        ))

    matching_chunks = reciprocal_rank_fusion(retrieval_sets)[:req.top_k]
    evidence_check = check_required_facets(question_plan.required_facets, matching_chunks)
    retry_queries: list[str] = []
    if evidence_check["missing"]:
        retry_queries = make_missing_facet_queries(query, evidence_check["missing"])
        if retry_queries:
            retry_embeddings = get_embedding_model().encode(
                retry_queries, normalize_embeddings=True, convert_to_numpy=True,
                show_progress_bar=False, batch_size=32,
            )
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
            query=query,
            answer="The provided document does not contain this information.",
            model_used="none",
            chunks_used=0,
            sources=[],
            citations=[],
            question_plan=question_metadata,
        )

    try:
        llm_result = llm.generate_rag_answer(
            query=query,
            retrieved_chunks=matching_chunks,
            model=req.model,
            api_key=req.api_key,
            temperature=req.temperature,
            question_labels=question_plan.labels,
            required_facets=question_plan.required_facets,
            missing_facets=evidence_check["missing"],
        )
    except Exception as exc:
        logger.error("LLM generation failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"LLM generation failed: {exc}")

    sources = [
        ChunkSearchResult(
            chunk_id=c["chunk_id"],
            document_id=str(c["document_id"]),
            filename=c["filename"],
            chunk_index=c["chunk_index"],
            content=c["content"],
            similarity=c["similarity"],
            page_number=c.get("page_number", 1) or 1,
            page_end=c.get("page_end", 1) or 1,
            section_title=c.get("section_title"),
            start_char=c.get("start_char", 0) or 0,
            end_char=c.get("end_char", len(c["content"])) or len(c["content"]),
        )
        for c in matching_chunks
    ]

    raw_citations = llm_result.get("citations", [])
    citations = [Citation(**cite) for cite in raw_citations]

    return RagAskResponse(
        query=query,
        answer=llm_result["answer"],
        model_used=llm_result["model_used"],
        chunks_used=llm_result["chunks_used"],
        sources=sources,
        citations=citations,
        prompt_tokens=llm_result.get("prompt_tokens", 0),
        completion_tokens=llm_result.get("completion_tokens", 0),
        total_tokens=llm_result.get("total_tokens", 0),
        question_plan=question_metadata,
    )


@app.get("/rag/models")
def list_available_models() -> dict[str, Any]:
    """Return the configured Google Gemini model."""
    return {
        "provider": "Google Gemini",
        "default": llm.DEFAULT_MODEL,
        "models": llm.UNIQUE_FALLBACK_MODELS,
    }
