import json
import logging
import os
from pathlib import Path
import sqlite3
from typing import Any
import uuid
from datetime import datetime, timezone

import numpy as np

try:
    import psycopg
    from psycopg.rows import dict_row
    from pgvector import Vector
    from pgvector.psycopg import register_vector
    HAS_PSYCOPG = True
except ImportError:
    HAS_PSYCOPG = False

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5434/vectordb"
)
SQLITE_DB_PATH = os.getenv("SQLITE_DB_PATH", "data/vectordb.sqlite")
DOCUMENTS_DIR = Path(os.getenv("DOCUMENTS_DIR", "data/documents"))
VECTOR_DIMENSIONS = 1024

_active_engine: str | None = None
_postgres_tested = False
_postgres_available = False
_sqlite_initialized = False


def is_postgres_available() -> bool:
    """Test if PostgreSQL is reachable and pgvector is supported (cached)."""
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


def save_document_file(doc_id: str | uuid.UUID, filename: str, content: bytes) -> str:
    """Save original document bytes to disk safely, returning storage_key."""
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    doc_id_str = str(doc_id)
    safe_filename = Path(filename).name
    storage_key = f"{doc_id_str}_{safe_filename}"
    target_path = (DOCUMENTS_DIR / storage_key).resolve()

    # Prevent path traversal outside DOCUMENTS_DIR
    if not target_path.is_relative_to(DOCUMENTS_DIR.resolve()):
        raise ValueError("Invalid storage path attempt.")

    target_path.write_bytes(content)
    return storage_key


def get_document_file_path(doc_id: str | uuid.UUID) -> Path | None:
    """Resolve and verify path to original document file."""
    doc_id_str = str(doc_id)
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Look in DOCUMENTS_DIR for file prefixed with doc_id
    for item in DOCUMENTS_DIR.iterdir():
        if item.is_file() and item.name.startswith(doc_id_str):
            resolved = item.resolve()
            if resolved.is_relative_to(DOCUMENTS_DIR.resolve()) and resolved.exists():
                return resolved

    # 2. Check metadata in database
    doc = get_document(doc_id)
    if doc:
        storage_key = doc.get("storage_key")
        if storage_key:
            candidate = (DOCUMENTS_DIR / storage_key).resolve()
            if candidate.is_relative_to(DOCUMENTS_DIR.resolve()) and candidate.exists():
                return candidate

        # 3. Check if matching file exists in workspace root
        filename = doc.get("filename")
        if filename:
            workspace_file = Path(filename).resolve()
            workspace_root = Path(".").resolve()
            if workspace_file.is_relative_to(workspace_root) and workspace_file.is_file():
                return workspace_file

    return None


def ensure_sqlite_tables(conn: sqlite3.Connection) -> None:
    """Ensure SQLite tables and metadata columns exist with automatic migration."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_units INTEGER NOT NULL,
            unit_type TEXT NOT NULL,
            embedding_model TEXT NOT NULL,
            created_at TEXT NOT NULL,
            storage_key TEXT,
            file_path TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS document_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            embedding BLOB NOT NULL,
            page_number INTEGER DEFAULT 1,
            page_end INTEGER DEFAULT 1,
            section_title TEXT,
            start_char INTEGER DEFAULT 0,
            end_char INTEGER DEFAULT 0,
            storage_key TEXT,
            FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
            UNIQUE (document_id, chunk_index)
        )
        """
    )

    # Automatic schema migration for existing SQLite databases
    cursor = conn.execute("PRAGMA table_info(document_chunks)")
    existing_chunk_cols = {row["name"] for row in cursor.fetchall()}
    new_chunk_cols = [
        ("page_number", "INTEGER DEFAULT 1"),
        ("page_end", "INTEGER DEFAULT 1"),
        ("section_title", "TEXT"),
        ("start_char", "INTEGER DEFAULT 0"),
        ("end_char", "INTEGER DEFAULT 0"),
        ("storage_key", "TEXT"),
    ]
    for col_name, col_def in new_chunk_cols:
        if col_name not in existing_chunk_cols:
            conn.execute(f"ALTER TABLE document_chunks ADD COLUMN {col_name} {col_def}")

    cursor = conn.execute("PRAGMA table_info(documents)")
    existing_doc_cols = {row["name"] for row in cursor.fetchall()}
    if "storage_key" not in existing_doc_cols:
        conn.execute("ALTER TABLE documents ADD COLUMN storage_key TEXT")
    if "file_path" not in existing_doc_cols:
        conn.execute("ALTER TABLE documents ADD COLUMN file_path TEXT")

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON document_chunks(document_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chunks_page_num ON document_chunks(document_id, page_number)"
    )
    conn.commit()


_initialized_db_paths: set[str] = set()


def get_sqlite_connection() -> sqlite3.Connection:
    """Get a connection to the local SQLite database."""
    db_path = Path(SQLITE_DB_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    resolved_key = str(db_path.resolve())
    if resolved_key not in _initialized_db_paths:
        ensure_sqlite_tables(conn)
        _initialized_db_paths.add(resolved_key)
    return conn


def get_active_engine() -> str:
    global _active_engine
    if _active_engine is None:
        _active_engine = "postgresql" if is_postgres_available() else "sqlite"
    return _active_engine


def set_active_engine(engine: str) -> None:
    global _active_engine
    _active_engine = engine


def initialize_database() -> str:
    """Initialize tables in either PostgreSQL or SQLite with page metadata columns."""
    engine = get_active_engine()
    if engine == "postgresql":
        try:
            with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
                conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
                register_vector(conn)
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS documents (
                        id UUID PRIMARY KEY,
                        filename TEXT NOT NULL,
                        source_type TEXT NOT NULL,
                        source_units INTEGER NOT NULL,
                        unit_type TEXT NOT NULL,
                        embedding_model TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        storage_key TEXT,
                        file_path TEXT
                    )
                    """
                )
                conn.execute(
                    f"""
                    CREATE TABLE IF NOT EXISTS document_chunks (
                        id BIGSERIAL PRIMARY KEY,
                        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                        chunk_index INTEGER NOT NULL,
                        content TEXT NOT NULL,
                        embedding VECTOR({VECTOR_DIMENSIONS}) NOT NULL,
                        page_number INTEGER DEFAULT 1,
                        page_end INTEGER DEFAULT 1,
                        section_title TEXT,
                        start_char INTEGER DEFAULT 0,
                        end_char INTEGER DEFAULT 0,
                        storage_key TEXT,
                        UNIQUE (document_id, chunk_index)
                    )
                    """
                )
                # Migrations for existing Postgres databases
                conn.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_key TEXT")
                conn.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_path TEXT")
                conn.execute("ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 1")
                conn.execute("ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS page_end INTEGER DEFAULT 1")
                conn.execute("ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS section_title TEXT")
                conn.execute("ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS start_char INTEGER DEFAULT 0")
                conn.execute("ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS end_char INTEGER DEFAULT 0")
                conn.execute("ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS storage_key TEXT")
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx "
                    "ON document_chunks (document_id)"
                )
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS document_chunks_page_num_idx "
                    "ON document_chunks (document_id, page_number)"
                )
            logger.info("Initialized PostgreSQL vector database.")
            return "postgresql"
        except Exception as exc:
            logger.warning("Failed to initialize PostgreSQL: %s. Falling back to SQLite.", exc)
            set_active_engine("sqlite")

    # SQLite fallback
    with get_sqlite_connection() as conn:
        ensure_sqlite_tables(conn)
    logger.info("Initialized local SQLite vector database at %s.", SQLITE_DB_PATH)
    return "sqlite"


def save_document(
    doc_id: uuid.UUID,
    filename: str,
    source_type: str,
    source_units: int,
    unit_type: str,
    embedding_model: str,
    chunks: list[str],
    embeddings: np.ndarray,
    chunk_metadata: list[dict[str, Any]] | None = None,
    storage_key: str | None = None,
    file_bytes: bytes | None = None,
) -> str:
    """Save document metadata, original file, and chunk vectors with page metadata."""
    engine = get_active_engine()
    created_at = datetime.now(timezone.utc).isoformat()
    doc_id_str = str(doc_id)

    # Persist original document file if bytes provided
    if file_bytes and not storage_key:
        storage_key = save_document_file(doc_id, filename, file_bytes)

    # Prepare normalized chunk metadata
    if not chunk_metadata:
        chunk_metadata = [
            {
                "page_number": 1,
                "page_end": 1,
                "section_title": None,
                "start_char": 0,
                "end_char": len(chunk),
                "storage_key": storage_key or "",
            }
            for chunk in chunks
        ]

    if engine == "postgresql":
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            register_vector(conn)
            inserted_document = conn.execute(
                """
                INSERT INTO documents
                    (id, filename, source_type, source_units, unit_type, embedding_model, storage_key)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING created_at::text AS created_at
                """,
                (
                    doc_id,
                    filename,
                    source_type,
                    source_units,
                    unit_type,
                    embedding_model,
                    storage_key,
                ),
            )
            created_at_str = inserted_document.fetchone()["created_at"]
            conn.cursor().executemany(
                """
                INSERT INTO document_chunks (
                    document_id, chunk_index, content, embedding,
                    page_number, page_end, section_title, start_char, end_char, storage_key
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    (
                        doc_id,
                        index,
                        chunk,
                        Vector(embedding.tolist()),
                        meta.get("page_number", 1),
                        meta.get("page_end", meta.get("page_number", 1)),
                        meta.get("section_title"),
                        meta.get("start_char", 0),
                        meta.get("end_char", len(chunk)),
                        meta.get("storage_key", storage_key or ""),
                    )
                    for index, (chunk, embedding, meta) in enumerate(
                        zip(chunks, embeddings, chunk_metadata)
                    )
                ],
            )
            return created_at_str

    # SQLite
    with get_sqlite_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO documents
                (id, filename, source_type, source_units, unit_type, embedding_model, created_at, storage_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                doc_id_str,
                filename,
                source_type,
                source_units,
                unit_type,
                embedding_model,
                created_at,
                storage_key,
            ),
        )
        chunk_data = [
            (
                doc_id_str,
                index,
                chunk,
                embedding.astype(np.float32).tobytes(),
                meta.get("page_number", 1),
                meta.get("page_end", meta.get("page_number", 1)),
                meta.get("section_title"),
                meta.get("start_char", 0),
                meta.get("end_char", len(chunk)),
                meta.get("storage_key", storage_key or ""),
            )
            for index, (chunk, embedding, meta) in enumerate(
                zip(chunks, embeddings, chunk_metadata)
            )
        ]
        conn.executemany(
            """
            INSERT OR REPLACE INTO document_chunks
                (document_id, chunk_index, content, embedding,
                 page_number, page_end, section_title, start_char, end_char, storage_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            chunk_data,
        )
    return created_at


def get_document(document_id: str | uuid.UUID) -> dict[str, Any] | None:
    """Fetch metadata for a single document."""
    engine = get_active_engine()
    doc_id_str = str(document_id)

    if engine == "postgresql":
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            row = conn.execute(
                """
                SELECT id::text AS id, filename, source_type, source_units, unit_type,
                       embedding_model, created_at::text AS created_at, storage_key, file_path
                FROM documents WHERE id = %s
                """,
                (document_id,),
            ).fetchone()
            return dict(row) if row else None

    with get_sqlite_connection() as conn:
        row = conn.execute(
            """
            SELECT id, filename, source_type, source_units, unit_type,
                   embedding_model, created_at, storage_key, file_path
            FROM documents WHERE id = ?
            """,
            (doc_id_str,),
        ).fetchone()
        return dict(row) if row else None


def get_page_metadata(document_id: str | uuid.UUID, page_number: int) -> dict[str, Any] | None:
    """Fetch metadata for a specific page of a document."""
    doc = get_document(document_id)
    if not doc:
        return None
    if page_number < 1 or page_number > doc["source_units"]:
        return None

    engine = get_active_engine()
    doc_id_str = str(document_id)

    if engine == "postgresql":
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            rows = conn.execute(
                """
                SELECT chunk_index, section_title, content
                FROM document_chunks
                WHERE document_id = %s AND page_number = %s
                ORDER BY chunk_index
                """,
                (document_id, page_number),
            ).fetchall()
    else:
        with get_sqlite_connection() as conn:
            rows = conn.execute(
                """
                SELECT chunk_index, section_title, content
                FROM document_chunks
                WHERE document_id = ? AND page_number = ?
                ORDER BY chunk_index
                """,
                (doc_id_str, page_number),
            ).fetchall()

    section_titles = list(dict.fromkeys(r["section_title"] for r in rows if r["section_title"]))
    return {
        "document_id": doc_id_str,
        "filename": doc["filename"],
        "page_number": page_number,
        "total_pages": doc["source_units"],
        "unit_type": doc["unit_type"],
        "chunk_count": len(rows),
        "section_titles": section_titles,
        "file_url": f"/documents/{doc_id_str}/file#page={page_number}",
    }


def list_documents() -> list[dict[str, Any]]:
    """List all stored documents with chunk count."""
    engine = get_active_engine()
    if engine == "postgresql":
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            rows = conn.execute(
                """
                SELECT d.id, d.filename, d.source_type, d.source_units, d.unit_type,
                       d.created_at::text AS created_at, d.storage_key, COUNT(c.id)::int AS chunk_count
                FROM documents AS d
                LEFT JOIN document_chunks AS c ON c.document_id = d.id
                GROUP BY d.id
                ORDER BY d.created_at DESC
                """
            ).fetchall()
        return [dict(row) for row in rows]

    # SQLite
    with get_sqlite_connection() as conn:
        rows = conn.execute(
            """
            SELECT d.id, d.filename, d.source_type, d.source_units, d.unit_type,
                   d.created_at, d.storage_key, COUNT(c.id) AS chunk_count
            FROM documents AS d
            LEFT JOIN document_chunks AS c ON c.document_id = d.id
            GROUP BY d.id
            ORDER BY d.created_at DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def get_document_chunks(
    document_id: str | uuid.UUID,
    limit: int = 5,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Inspect chunks and embedding vectors for a specific document."""
    engine = get_active_engine()
    doc_id_str = str(document_id)

    if engine == "postgresql":
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            register_vector(conn)
            rows = conn.execute(
                """
                SELECT chunk_index, content, embedding,
                       page_number, page_end, section_title, start_char, end_char
                FROM document_chunks
                WHERE document_id = %s
                ORDER BY chunk_index
                LIMIT %s OFFSET %s
                """,
                (document_id, limit, offset),
            ).fetchall()
        return [
            {
                "chunk_index": row["chunk_index"],
                "content": row["content"],
                "embedding": row["embedding"].to_list() if hasattr(row["embedding"], "to_list") else list(row["embedding"]),
                "page_number": row.get("page_number", 1) or 1,
                "page_end": row.get("page_end", 1) or 1,
                "section_title": row.get("section_title"),
                "start_char": row.get("start_char", 0) or 0,
                "end_char": row.get("end_char", len(row["content"])) or len(row["content"]),
            }
            for row in rows
        ]

    # SQLite
    with get_sqlite_connection() as conn:
        rows = conn.execute(
            """
            SELECT chunk_index, content, embedding,
                   page_number, page_end, section_title, start_char, end_char
            FROM document_chunks
            WHERE document_id = ?
            ORDER BY chunk_index
            LIMIT ? OFFSET ?
            """,
            (doc_id_str, limit, offset),
        ).fetchall()

    result = []
    for row in rows:
        emb_bytes = row["embedding"]
        emb_list = np.frombuffer(emb_bytes, dtype=np.float32).tolist()
        row_keys = row.keys()
        result.append(
            {
                "chunk_index": row["chunk_index"],
                "content": row["content"],
                "embedding": emb_list,
                "page_number": int(row["page_number"]) if "page_number" in row_keys and row["page_number"] is not None else 1,
                "page_end": int(row["page_end"]) if "page_end" in row_keys and row["page_end"] is not None else 1,
                "section_title": row["section_title"] if "section_title" in row_keys else None,
                "start_char": int(row["start_char"]) if "start_char" in row_keys and row["start_char"] is not None else 0,
                "end_char": int(row["end_char"]) if "end_char" in row_keys and row["end_char"] is not None else len(row["content"]),
            }
        )
    return result


def delete_document(document_id: str | uuid.UUID) -> bool:
    """Delete a document, all its chunks, and associated storage file."""
    engine = get_active_engine()
    doc_id_str = str(document_id)

    # Delete stored file if exists
    try:
        file_path = get_document_file_path(document_id)
        if file_path and file_path.is_relative_to(DOCUMENTS_DIR.resolve()) and file_path.exists():
            file_path.unlink(missing_ok=True)
    except Exception as exc:
        logger.warning("Could not delete stored file for document %s: %s", doc_id_str, exc)

    if engine == "postgresql":
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            res = conn.execute(
                "DELETE FROM documents WHERE id = %s", (document_id,)
            )
            return res.rowcount > 0

    with get_sqlite_connection() as conn:
        conn.execute("DELETE FROM document_chunks WHERE document_id = ?", (doc_id_str,))
        res = conn.execute("DELETE FROM documents WHERE id = ?", (doc_id_str,))
        return res.rowcount > 0


def search_similar_chunks(
    query_vector: np.ndarray | list[float],
    top_k: int = 4,
    document_id: str | uuid.UUID | None = None,
    min_similarity: float = 0.0,
) -> list[dict[str, Any]]:
    """
    Search for top_k most similar document chunks using cosine similarity.
    Returns list of dicts with chunk details, page numbers, section titles, and similarity score.
    """
    if isinstance(query_vector, list):
        query_vector = np.array(query_vector, dtype=np.float32)

    # Normalize query vector
    norm = np.linalg.norm(query_vector)
    if norm > 0:
        query_vector = query_vector / norm

    engine = get_active_engine()

    if engine == "postgresql":
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            register_vector(conn)
            query_v = Vector(query_vector.tolist())
            if document_id:
                sql = """
                    SELECT c.id, c.document_id::text AS document_id, d.filename,
                           c.chunk_index, c.content,
                           c.page_number, c.page_end, c.section_title, c.start_char, c.end_char, c.storage_key,
                           1 - (c.embedding <=> %s) AS similarity
                    FROM document_chunks c
                    JOIN documents d ON d.id = c.document_id
                    WHERE c.document_id = %s
                    ORDER BY c.embedding <=> %s
                    LIMIT %s
                """
                params = (query_v, document_id, query_v, top_k)
            else:
                sql = """
                    SELECT c.id, c.document_id::text AS document_id, d.filename,
                           c.chunk_index, c.content,
                           c.page_number, c.page_end, c.section_title, c.start_char, c.end_char, c.storage_key,
                           1 - (c.embedding <=> %s) AS similarity
                    FROM document_chunks c
                    JOIN documents d ON d.id = c.document_id
                    ORDER BY c.embedding <=> %s
                    LIMIT %s
                """
                params = (query_v, query_v, top_k)
            rows = conn.execute(sql, params).fetchall()

        return [
            {
                "chunk_id": row["id"],
                "document_id": str(row["document_id"]),
                "filename": row["filename"],
                "chunk_index": row["chunk_index"],
                "content": row["content"],
                "similarity": float(row["similarity"]),
                "page_number": int(row["page_number"]) if row.get("page_number") is not None else 1,
                "page_end": int(row["page_end"]) if row.get("page_end") is not None else 1,
                "section_title": row.get("section_title"),
                "start_char": int(row["start_char"]) if row.get("start_char") is not None else 0,
                "end_char": int(row["end_char"]) if row.get("end_char") is not None else len(row["content"]),
                "storage_key": row.get("storage_key") or "",
            }
            for row in rows
            if float(row["similarity"]) >= min_similarity
        ]

    # SQLite search using vectorized NumPy operations
    with get_sqlite_connection() as conn:
        if document_id:
            rows = conn.execute(
                """
                SELECT c.id, c.document_id, d.filename, c.chunk_index, c.content, c.embedding,
                       c.page_number, c.page_end, c.section_title, c.start_char, c.end_char, c.storage_key
                FROM document_chunks c
                JOIN documents d ON d.id = c.document_id
                WHERE c.document_id = ?
                """,
                (str(document_id),),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT c.id, c.document_id, d.filename, c.chunk_index, c.content, c.embedding,
                       c.page_number, c.page_end, c.section_title, c.start_char, c.end_char, c.storage_key
                FROM document_chunks c
                JOIN documents d ON d.id = c.document_id
                """
            ).fetchall()

    if not rows:
        return []

    # Stack embeddings into a 2D matrix
    embeddings_list = [np.frombuffer(row["embedding"], dtype=np.float32) for row in rows]
    embeddings_matrix = np.vstack(embeddings_list)

    # Compute norms and cosine similarities
    row_norms = np.linalg.norm(embeddings_matrix, axis=1, keepdims=True)
    row_norms[row_norms == 0] = 1e-10
    normalized_matrix = embeddings_matrix / row_norms

    cosine_scores = np.dot(normalized_matrix, query_vector).flatten()

    # Get top-k indices
    num_results = min(top_k, len(rows))
    top_indices = np.argsort(cosine_scores)[::-1][:num_results]

    results = []
    for idx in top_indices:
        sim = float(cosine_scores[idx])
        if sim >= min_similarity:
            row = rows[idx]
            row_keys = row.keys()
            results.append(
                {
                    "chunk_id": row["id"],
                    "document_id": str(row["document_id"]),
                    "filename": row["filename"],
                    "chunk_index": row["chunk_index"],
                    "content": row["content"],
                    "similarity": round(sim, 4),
                    "page_number": int(row["page_number"]) if "page_number" in row_keys and row["page_number"] is not None else 1,
                    "page_end": int(row["page_end"]) if "page_end" in row_keys and row["page_end"] is not None else 1,
                    "section_title": row["section_title"] if "section_title" in row_keys else None,
                    "start_char": int(row["start_char"]) if "start_char" in row_keys and row["start_char"] is not None else 0,
                    "end_char": int(row["end_char"]) if "end_char" in row_keys and row["end_char"] is not None else len(row["content"]),
                    "storage_key": row["storage_key"] if "storage_key" in row_keys and row["storage_key"] is not None else "",
                }
            )
    return results
