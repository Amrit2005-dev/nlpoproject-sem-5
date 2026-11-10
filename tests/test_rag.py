import uuid
import numpy as np
import pytest
from app import db
from app import llm
from app.rag.question_segmentation import classify_question, plan_retrieval, reciprocal_rank_fusion


def test_sqlite_document_save_and_vector_search(tmp_path, monkeypatch):
    test_db_path = str(tmp_path / "test_rag.sqlite")
    monkeypatch.setattr(db, "SQLITE_DB_PATH", test_db_path)
    monkeypatch.setattr(db, "get_active_engine", lambda: "sqlite")

    db.initialize_database()

    doc_id = uuid.uuid4()
    chunks = [
        "Data structures and algorithms are fundamental to computer science.",
        "Engineering Calculus covers derivatives, integrals, and vector analysis.",
        "Artificial Intelligence includes machine learning and deep neural networks.",
    ]

    # Generate 3 mock normalized embeddings
    np.random.seed(42)
    embeddings = np.random.randn(3, db.VECTOR_DIMENSIONS).astype(np.float32)
    embeddings /= np.linalg.norm(embeddings, axis=1, keepdims=True)

    db.save_document(
        doc_id=doc_id,
        filename="curriculum.pdf",
        source_type="pdf",
        source_units=3,
        unit_type="pages",
        embedding_model="test-model",
        chunks=chunks,
        embeddings=embeddings,
    )

    # Document should be listed
    docs = db.list_documents()
    assert len(docs) == 1
    assert docs[0]["filename"] == "curriculum.pdf"
    assert docs[0]["chunk_count"] == 3

    # Query using the embedding of the first chunk
    query_vec = embeddings[0]
    results = db.search_similar_chunks(query_vector=query_vec, top_k=2)
    assert len(results) == 2
    # First result must be chunk 0 with similarity ~ 1.0
    assert results[0]["chunk_index"] == 0
    assert results[0]["filename"] == "curriculum.pdf"
    assert results[0]["similarity"] >= 0.99


def test_prompt_context_formatting():
    chunks = [
        {
            "filename": "syllabus.pdf",
            "chunk_index": 2,
            "similarity": 0.88,
            "content": "Operating Systems course covers process synchronization and deadlocks.",
        }
    ]
    formatted = llm.format_context_for_prompt(chunks)
    assert "[EXCERPT 1] Source: syllabus.pdf | Chunk: 2" in formatted
    assert "process synchronization" in formatted


def test_format_context_empty():
    assert "No relevant context" in llm.format_context_for_prompt([])


def test_hinglish_question_segmentation():
    labels, confidence = classify_question("SVM aur Random Forest ka difference aur kaise calculate karte hain?")
    assert "comparison" in labels
    assert "algorithm" in labels
    assert confidence >= 0.8

    plan = plan_retrieval("Pehle definition batao aur phir ek example do")
    assert "multi_part" in plan.labels
    assert len(plan.required_facets) >= 2
    assert len(plan.queries) >= 2


def test_reciprocal_rank_fusion_deduplicates_chunks():
    first = [{"chunk_id": 1, "document_id": "d1", "content": "A"}, {"chunk_id": 2, "document_id": "d1", "content": "B"}]
    second = [{"chunk_id": 2, "document_id": "d1", "content": "B"}, {"chunk_id": 3, "document_id": "d1", "content": "C"}]
    merged = reciprocal_rank_fusion([first, second])
    assert len(merged) == 3
    assert merged[0]["chunk_id"] == 2
