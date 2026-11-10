from pathlib import Path
import uuid
from fastapi.testclient import TestClient
import numpy as np
import pymupdf as fitz
import pytest

from app import db
from app.main import app

client = TestClient(app)


@pytest.fixture
def sample_pdf_document(tmp_path, monkeypatch):
    """Fixture to create and save a real PDF document in the test database."""
    test_db = str(tmp_path / "test_serve.sqlite")
    test_docs_dir = tmp_path / "documents"
    test_docs_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(db, "SQLITE_DB_PATH", test_db)
    monkeypatch.setattr(db, "DOCUMENTS_DIR", test_docs_dir)
    monkeypatch.setattr(db, "get_active_engine", lambda: "sqlite")

    db.initialize_database()

    # Generate a genuine 2-page PDF
    pdf_doc = fitz.open()
    p1 = pdf_doc.new_page()
    p1.insert_text((72, 72), "Page 1 Content: Introduction to Vector Search")
    p2 = pdf_doc.new_page()
    p2.insert_text((72, 72), "Page 2 Content: Cosine Similarity and Dot Product")
    pdf_bytes = pdf_doc.tobytes()

    doc_id = uuid.uuid4()
    chunks = [
        "Page 1 Content: Introduction to Vector Search",
        "Page 2 Content: Cosine Similarity and Dot Product",
    ]
    meta = [
        {
            "page_number": 1,
            "page_end": 1,
            "section_title": "Introduction",
            "start_char": 0,
            "end_char": 40,
        },
        {
            "page_number": 2,
            "page_end": 2,
            "section_title": "Similarity Metrics",
            "start_char": 0,
            "end_char": 42,
        },
    ]
    embs = np.random.randn(2, db.VECTOR_DIMENSIONS).astype(np.float32)

    db.save_document(
        doc_id=doc_id,
        filename="lecture_vectors.pdf",
        source_type="pdf",
        source_units=2,
        unit_type="pages",
        embedding_model="test-model",
        chunks=chunks,
        embeddings=embs,
        chunk_metadata=meta,
        file_bytes=pdf_bytes,
    )

    return doc_id, test_docs_dir


def test_get_document_file_serves_pdf_with_correct_headers(sample_pdf_document):
    doc_id, _ = sample_pdf_document
    response = client.get(f"/documents/{doc_id}/file")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "inline" in response.headers["content-disposition"]
    assert "lecture_vectors.pdf" in response.headers["content-disposition"]
    # PDF starts with %PDF header
    assert response.content.startswith(b"%PDF")


def test_get_page_info_returns_accurate_page_metadata(sample_pdf_document):
    doc_id, _ = sample_pdf_document
    # Page 1
    res1 = client.get(f"/documents/{doc_id}/pages/1")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["page_number"] == 1
    assert data1["total_pages"] == 2
    assert "Introduction" in data1["section_titles"]
    assert f"/documents/{doc_id}/file#page=1" in data1["file_url"]

    # Page 2
    res2 = client.get(f"/documents/{doc_id}/pages/2")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["page_number"] == 2
    assert "Similarity Metrics" in data2["section_titles"]


def test_get_page_info_rejects_invalid_page_number(sample_pdf_document):
    doc_id, _ = sample_pdf_document
    # Page 0 (out of range)
    res_zero = client.get(f"/documents/{doc_id}/pages/0")
    assert res_zero.status_code == 422

    # Page 99 (document has only 2 pages)
    res_overflow = client.get(f"/documents/{doc_id}/pages/99")
    assert res_overflow.status_code == 422


def test_missing_document_returns_404(sample_pdf_document):
    non_existent_id = uuid.uuid4()
    res = client.get(f"/documents/{non_existent_id}/file")
    assert res.status_code == 404

    res_page = client.get(f"/documents/{non_existent_id}/pages/1")
    assert res_page.status_code == 404
