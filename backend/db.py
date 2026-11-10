"""Database layer: PostgreSQL + SQLite dual-engine vector store with automatic fallback."""

import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import uuid

import numpy as np

from backend.config import (
    DATABASE_URL,
    SQLITE_DB_PATH,
    DOCUMENTS_DIR,
    VECTOR_DIMENSIONS,
)

try:
    import psycopg
    from psycopg.rows import dict_row
    from pgvector import Vector
    from pgvector.psycopg import register_vector
    HAS_PSYCOPG = True
except ImportError:
    HAS_PSYCOPG = False

logger = logging.getLogger(__name__)

_active_engine: str | None = None
_postgres_tested = False
_postgres_available = False
_initialized_db_paths: set[str] = set()


def is_postgres_available() -> bool:
    global _postgres_tested, _postgres_available
    if _postgres_tested:
        return _postgres_available
    if not HAS_PSYCOPG:
        _postgres_tested = True
        _postgres_available = False
        return False
    try:
        with psycopg.connect(DATABASE_URL, connect_timeout=1.5) as conn:
            conn.execute("SELECT 1")
        _postgres_available = True
    except Exception as exc:
        logger.warning("PostgreSQL connection failed (%s). Falling back to SQLite.", exc)
        _postgres_available = False
    _postgres_tested = True
    return _postgres_available


def get_active_engine() -> str:
    global _active_engine
    if _active_engine is None:
        _active_engine = "postgresql" if is_postgres_available() else "sqlite"
    return _active_engine


def set_active_engine(engine: str) -> None:
    global _active_engine
    _active_engine = engine


def save_document_file(doc_id: str | uuid.UUID, filename: str, content: bytes) -> str:
    """Save original document bytes to disk safely, returning storage_key."""
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    doc_id_str = str(doc_id)
    safe_filename = Path(filename).name
    storage_key = f"{doc_id_str}_{safe_filename}"
    target_path = (DOCUMENTS_DIR / storage_key).resolve()
    if not target_path.is_relative_to(DOCUMENTS_DIR.resolve()):
        raise ValueError("Invalid storage path attempt.")
    target_path.write_bytes(content)
    return storage_key


def get_document_file_path(doc_id: str | uuid.UUID) -> Path | None:
    """Resolve and verify path to original document file."""
    doc_id_str = str(doc_id)
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    for item in DOCUMENTS_DIR.iterdir():
        if item.is_file() and item.name.startswith(doc_id_str):
            resolved = item.resolve()
            if resolved.is_relative_to(DOCUMENTS_DIR.resolve()) and resolved.exists():
                return resolved
    doc = get_document(doc_id)
    if doc:
        storage_key = doc.get("storage_key")
        if storage_key:
            candidate = (DOCUMENTS_DIR / storage_key).resolve()
            if candidate.is_relative_to(DOCUMENTS_DIR.resolve()) and candidate.exists():
                return candidate
        filename = doc.get("filename")
        if filename:
            workspace_file = Path(filename).resolve()
            workspace_root = Path(".").resolve()
            if workspace_file.is_relative_to(workspace_root) and workspace_file.is_file():
                return workspace_file
    return None


def ensure_sqlite_tables(conn: sqlite3.Connection) -> None:
    conn.execute("""CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY, filename TEXT NOT NULL, source_type TEXT NOT NULL,
        source_units INTEGER NOT NULL, unit_type TEXT NOT NULL,
        embedding_model TEXT NOT NULL, created_at TEXT NOT NULL,
        storage_key TEXT, file_path TEXT)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS document_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT, document_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL, content TEXT NOT NULL, embedding BLOB NOT NULL,
        page_number INTEGER DEFAULT 1, page_end INTEGER DEFAULT 1,
        section_title TEXT, start_char INTEGER DEFAULT 0, end_char INTEGER DEFAULT 0,
        storage_key TEXT,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
        UNIQUE (document_id, chunk_index))""")
    cursor = conn.execute("PRAGMA table_info(document_chunks)")
    existing = {r["name"] for r in cursor.fetchall()}
    for col, defn in [("page_number", "INTEGER DEFAULT 1"), ("page_end", "INTEGER DEFAULT 1"),
                      ("section_title", "TEXT"), ("start_char", "INTEGER DEFAULT 0"),
                      ("end_char", "INTEGER DEFAULT 0"), ("storage_key", "TEXT")]:
        if col not in existing:
            conn.execute(f"ALTER TABLE document_chunks ADD COLUMN {col} {defn}")
    cursor = conn.execute("PRAGMA table_info(documents)")
    dcols = {r["name"] for r in cursor.fetchall()}
    if "storage_key" not in dcols:
        conn.execute("ALTER TABLE documents ADD COLUMN storage_key TEXT")
    if "file_path" not in dcols:
        conn.execute("ALTER TABLE documents ADD COLUMN file_path TEXT")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON document_chunks(document_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_chunks_page_num ON document_chunks(document_id, page_number)")
    conn.commit()


def get_sqlite_connection() -> sqlite3.Connection:
    db_path = Path(SQLITE_DB_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    resolved_key = str(db_path.resolve())
    if resolved_key not in _initialized_db_paths:
        ensure_sqlite_tables(conn)
        _initialized_db_paths.add(resolved_key)
    return conn


def initialize_database() -> str:
    """Initialize tables in either PostgreSQL or SQLite."""
    engine = get_active_engine()
    if engine == "postgresql":
        try:
            with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
                conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
                register_vector(conn)
                conn.execute("""CREATE TABLE IF NOT EXISTS documents (
                    id UUID PRIMARY KEY, filename TEXT NOT NULL, source_type TEXT NOT NULL,
                    source_units INTEGER NOT NULL, unit_type TEXT NOT NULL,
                    embedding_model TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    storage_key TEXT, file_path TEXT)""")
                conn.execute(f"""CREATE TABLE IF NOT EXISTS document_chunks (
                    id BIGSERIAL PRIMARY KEY,
                    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                    chunk_index INTEGER NOT NULL, content TEXT NOT NULL,
                    embedding VECTOR({VECTOR_DIMENSIONS}) NOT NULL,
                    page_number INTEGER DEFAULT 1, page_end INTEGER DEFAULT 1,
                    section_title TEXT, start_char INTEGER DEFAULT 0, end_char INTEGER DEFAULT 0,
                    storage_key TEXT, UNIQUE (document_id, chunk_index))""")
                for stmt in [
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_key TEXT",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_path TEXT",
                    "ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 1",
                    "ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS page_end INTEGER DEFAULT 1",
                    "ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS section_title TEXT",
                    "ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS start_char INTEGER DEFAULT 0",
                    "ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS end_char INTEGER DEFAULT 0",
                    "ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS storage_key TEXT",
                    "CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks (document_id)",
                    "CREATE INDEX IF NOT EXISTS document_chunks_page_num_idx ON document_chunks (document_id, page_number)",
                ]:
                    conn.execute(stmt)
            logger.info("Initialized PostgreSQL vector database.")
            return "postgresql"
        except Exception as exc:
            logger.warning("Failed to initialize PostgreSQL: %s. Falling back to SQLite.", exc)
            set_active_engine("sqlite")
    with get_sqlite_connection() as conn:
        ensure_sqlite_tables(conn)
    logger.info("Initialized local SQLite vector database at %s.", SQLITE_DB_PATH)
    return "sqlite"


def save_document(
    doc_id: uuid.UUID, filename: str, source_type: str, source_units: int,
    unit_type: str, embedding_model: str, chunks: list[str], embeddings: np.ndarray,
    chunk_metadata: list[dict[str, Any]] | None = None,
    storage_key: str | None = None, file_bytes: bytes | None = None,
) -> str:
    """Save document metadata, original file, and chunk vectors with page metadata."""
    engine = get_active_engine()
    created_at = datetime.now(timezone.utc).isoformat()
    doc_id_str = str(doc_id)
    if file_bytes and not storage_key:
        storage_key = save_document_file(doc_id, filename, file_bytes)
    if not chunk_metadata:
        chunk_metadata = [{"page_number": 1, "page_end": 1, "section_title": None,
                           "start_char": 0, "end_char": len(c), "storage_key": storage_key or ""}
                          for c in chunks]
    if engine == "postgresql":
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            register_vector(conn)
            row = conn.execute(
                "INSERT INTO documents (id,filename,source_type,source_units,unit_type,embedding_model,storage_key) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING created_at::text AS created_at",
                (doc_id, filename, source_type, source_units, unit_type, embedding_model, storage_key),
            ).fetchone()
            conn.cursor().executemany(
                "INSERT INTO document_chunks (document_id,chunk_index,content,embedding,"
                "page_number,page_end,section_title,start_char,end_char,storage_key) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                [(doc_id, i, ch, Vector(emb.tolist()),
                  meta.get("page_number", 1), meta.get("page_end", meta.get("page_number", 1)),
                  meta.get("section_title"), meta.get("start_char", 0), meta.get("end_char", len(ch)),
                  meta.get("storage_key", storage_key or ""))
                 for i, (ch, emb, meta) in enumerate(zip(chunks, embeddings, chunk_metadata))],
            )
            return row["created_at"]
    with get_sqlite_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO documents (id,filename,source_type,source_units,unit_type,embedding_model,created_at,storage_key) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (doc_id_str, filename, source_type, source_units, unit_type, embedding_model, created_at, storage_key),
        )
        conn.executemany(
            "INSERT OR REPLACE INTO document_chunks (document_id,chunk_index,content,embedding,"
            "page_number,page_end,section_title,start_char,end_char,storage_key) VALUES (?,?,?,?,?,?,?,?,?,?)",
            [(doc_id_str, i, ch, emb.astype(np.float32).tobytes(),
              meta.get("page_number", 1), meta.get("page_end", meta.get("page_number", 1)),
              meta.get("section_title"), meta.get("start_char", 0), meta.get("end_char", len(ch)),
              meta.get("storage_key", storage_key or ""))
             for i, (ch, emb, meta) in enumerate(zip(chunks, embeddings, chunk_metadata))],
        )
    return created_at


def get_document(document_id: str | uuid.UUID) -> dict[str, Any] | None:
    engine = get_active_engine()
    doc_id_str = str(document_id)
    if engine == "postgresql":
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            row = conn.execute(
                "SELECT id::text AS id,filename,source_type,source_units,unit_type,"
                "embedding_model,created_at::text AS created_at,storage_key,file_path "
                "FROM documents WHERE id=%s", (document_id,)
            ).fetchone()
            return dict(row) if row else None
    with get_sqlite_connection() as conn:
        row = conn.execute(
            "SELECT id,filename,source_type,source_units,unit_type,"
            "embedding_model,created_at,storage_key,file_path FROM documents WHERE id=?",
            (doc_id_str,)
        ).fetchone()
        return dict(row) if row else None


def get_page_metadata(document_id: str | uuid.UUID, page_number: int) -> dict[str, Any] | None:
    doc = get_document(document_id)
    if not doc or page_number < 1 or page_number > doc["source_units"]:
        return None
    engine = get_active_engine()
    doc_id_str = str(document_id)
    if engine == "postgresql":
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            rows = conn.execute(
                "SELECT chunk_index,section_title,content FROM document_chunks "
                "WHERE document_id=%s AND page_number=%s ORDER BY chunk_index",
                (document_id, page_number)
            ).fetchall()
    else:
        with get_sqlite_connection() as conn:
            rows = conn.execute(
                "SELECT chunk_index,section_title,content FROM document_chunks "
                "WHERE document_id=? AND page_number=? ORDER BY chunk_index",
                (doc_id_str, page_number)
            ).fetchall()
    section_titles = list(dict.fromkeys(r["section_title"] for r in rows if r["section_title"]))
    return {
        "document_id": doc_id_str, "filename": doc["filename"],
        "page_number": page_number, "total_pages": doc["source_units"],
        "unit_type": doc["unit_type"], "chunk_count": len(rows),
        "section_titles": section_titles,
        "file_url": f"/api/documents/{doc_id_str}/file#page={page_number}",
    }


def list_documents() -> list[dict[str, Any]]:
    engine = get_active_engine()
    if engine == "postgresql":
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            rows = conn.execute(
                "SELECT d.id,d.filename,d.source_type,d.source_units,d.unit_type,"
                "d.created_at::text AS created_at,d.storage_key,COUNT(c.id)::int AS chunk_count "
                "FROM documents d LEFT JOIN document_chunks c ON c.document_id=d.id "
                "GROUP BY d.id ORDER BY d.created_at DESC"
            ).fetchall()
        return [dict(r) for r in rows]
    with get_sqlite_connection() as conn:
        rows = conn.execute(
            "SELECT d.id,d.filename,d.source_type,d.source_units,d.unit_type,"
            "d.created_at,d.storage_key,COUNT(c.id) AS chunk_count "
            "FROM documents d LEFT JOIN document_chunks c ON c.document_id=d.id "
            "GROUP BY d.id ORDER BY d.created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_document_chunks(document_id: str | uuid.UUID, limit: int = 5, offset: int = 0) -> list[dict[str, Any]]:
    engine = get_active_engine()
    doc_id_str = str(document_id)
    if engine == "postgresql":
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            register_vector(conn)
            rows = conn.execute(
                "SELECT chunk_index,content,embedding,page_number,page_end,section_title,start_char,end_char "
                "FROM document_chunks WHERE document_id=%s ORDER BY chunk_index LIMIT %s OFFSET %s",
                (document_id, limit, offset)
            ).fetchall()
        return [{"chunk_index": r["chunk_index"], "content": r["content"],
                 "embedding": r["embedding"].to_list() if hasattr(r["embedding"], "to_list") else list(r["embedding"]),
                 "page_number": r.get("page_number", 1) or 1, "page_end": r.get("page_end", 1) or 1,
                 "section_title": r.get("section_title"),
                 "start_char": r.get("start_char", 0) or 0, "end_char": r.get("end_char", len(r["content"])) or len(r["content"])}
                for r in rows]
    with get_sqlite_connection() as conn:
        rows = conn.execute(
            "SELECT chunk_index,content,embedding,page_number,page_end,section_title,start_char,end_char "
            "FROM document_chunks WHERE document_id=? ORDER BY chunk_index LIMIT ? OFFSET ?",
            (doc_id_str, limit, offset)
        ).fetchall()
    result = []
    for r in rows:
        k = r.keys()
        result.append({
            "chunk_index": r["chunk_index"], "content": r["content"],
            "embedding": np.frombuffer(r["embedding"], dtype=np.float32).tolist(),
            "page_number": int(r["page_number"]) if "page_number" in k and r["page_number"] is not None else 1,
            "page_end": int(r["page_end"]) if "page_end" in k and r["page_end"] is not None else 1,
            "section_title": r["section_title"] if "section_title" in k else None,
            "start_char": int(r["start_char"]) if "start_char" in k and r["start_char"] is not None else 0,
            "end_char": int(r["end_char"]) if "end_char" in k and r["end_char"] is not None else len(r["content"]),
        })
    return result


def delete_document(document_id: str | uuid.UUID) -> bool:
    engine = get_active_engine()
    doc_id_str = str(document_id)
    try:
        fp = get_document_file_path(document_id)
        if fp and fp.is_relative_to(DOCUMENTS_DIR.resolve()) and fp.exists():
            fp.unlink(missing_ok=True)
    except Exception as exc:
        logger.warning("Could not delete stored file for %s: %s", doc_id_str, exc)
    if engine == "postgresql":
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            res = conn.execute("DELETE FROM documents WHERE id=%s", (document_id,))
            return res.rowcount > 0
    with get_sqlite_connection() as conn:
        conn.execute("DELETE FROM document_chunks WHERE document_id=?", (doc_id_str,))
        res = conn.execute("DELETE FROM documents WHERE id=?", (doc_id_str,))
        return res.rowcount > 0


def search_similar_chunks(
    query_vector: np.ndarray | list[float], top_k: int = 4,
    document_id: str | uuid.UUID | None = None, min_similarity: float = 0.0,
) -> list[dict[str, Any]]:
    """Search for top_k most similar document chunks using cosine similarity."""
    if isinstance(query_vector, list):
        query_vector = np.array(query_vector, dtype=np.float32)
    norm = np.linalg.norm(query_vector)
    if norm > 0:
        query_vector = query_vector / norm
    engine = get_active_engine()
    if engine == "postgresql":
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            register_vector(conn)
            qv = Vector(query_vector.tolist())
            if document_id:
                sql = ("SELECT c.id,c.document_id::text AS document_id,d.filename,c.chunk_index,c.content,"
                       "c.page_number,c.page_end,c.section_title,c.start_char,c.end_char,c.storage_key,"
                       "1-(c.embedding<=>%s) AS similarity FROM document_chunks c JOIN documents d ON d.id=c.document_id "
                       "WHERE c.document_id=%s ORDER BY c.embedding<=>%s LIMIT %s")
                params = (qv, document_id, qv, top_k)
            else:
                sql = ("SELECT c.id,c.document_id::text AS document_id,d.filename,c.chunk_index,c.content,"
                       "c.page_number,c.page_end,c.section_title,c.start_char,c.end_char,c.storage_key,"
                       "1-(c.embedding<=>%s) AS similarity FROM document_chunks c JOIN documents d ON d.id=c.document_id "
                       "ORDER BY c.embedding<=>%s LIMIT %s")
                params = (qv, qv, top_k)
            rows = conn.execute(sql, params).fetchall()
        return [{"chunk_id": r["id"], "document_id": str(r["document_id"]), "filename": r["filename"],
                 "chunk_index": r["chunk_index"], "content": r["content"], "similarity": float(r["similarity"]),
                 "page_number": int(r["page_number"]) if r.get("page_number") is not None else 1,
                 "page_end": int(r["page_end"]) if r.get("page_end") is not None else 1,
                 "section_title": r.get("section_title"),
                 "start_char": int(r["start_char"]) if r.get("start_char") is not None else 0,
                 "end_char": int(r["end_char"]) if r.get("end_char") is not None else len(r["content"]),
                 "storage_key": r.get("storage_key") or ""}
                for r in rows if float(r["similarity"]) >= min_similarity]
    with get_sqlite_connection() as conn:
        if document_id:
            rows = conn.execute(
                "SELECT c.id,c.document_id,d.filename,c.chunk_index,c.content,c.embedding,"
                "c.page_number,c.page_end,c.section_title,c.start_char,c.end_char,c.storage_key "
                "FROM document_chunks c JOIN documents d ON d.id=c.document_id WHERE c.document_id=?",
                (str(document_id),)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT c.id,c.document_id,d.filename,c.chunk_index,c.content,c.embedding,"
                "c.page_number,c.page_end,c.section_title,c.start_char,c.end_char,c.storage_key "
                "FROM document_chunks c JOIN documents d ON d.id=c.document_id"
            ).fetchall()
    if not rows:
        return []
    embs = [np.frombuffer(r["embedding"], dtype=np.float32) for r in rows]
    mat = np.vstack(embs)
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms[norms == 0] = 1e-10
    scores = np.dot(mat / norms, query_vector).flatten()
    top_idx = np.argsort(scores)[::-1][:min(top_k, len(rows))]
    results = []
    for idx in top_idx:
        sim = float(scores[idx])
        if sim >= min_similarity:
            r = rows[idx]
            k = r.keys()
            results.append({
                "chunk_id": r["id"], "document_id": str(r["document_id"]), "filename": r["filename"],
                "chunk_index": r["chunk_index"], "content": r["content"], "similarity": round(sim, 4),
                "page_number": int(r["page_number"]) if "page_number" in k and r["page_number"] is not None else 1,
                "page_end": int(r["page_end"]) if "page_end" in k and r["page_end"] is not None else 1,
                "section_title": r["section_title"] if "section_title" in k else None,
                "start_char": int(r["start_char"]) if "start_char" in k and r["start_char"] is not None else 0,
                "end_char": int(r["end_char"]) if "end_char" in k and r["end_char"] is not None else len(r["content"]),
                "storage_key": r["storage_key"] if "storage_key" in k and r["storage_key"] is not None else "",
            })
    return results
