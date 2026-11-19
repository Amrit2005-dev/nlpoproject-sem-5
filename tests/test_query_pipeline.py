from backend import main
from backend.models.schemas import RagAskRequest
from fastapi import HTTPException

DOCUMENT_ID = "00000000-0000-0000-0000-000000000001"


def test_rag_endpoint_uses_rewritten_query_and_follow_up_context(monkeypatch) -> None:
    seen = {}
    chunk = {
        "chunk_id": 1,
        "document_id": DOCUMENT_ID,
        "filename": "notes.pdf",
        "chunk_index": 0,
        "content": "RNNs process sequential input.",
        "similarity": 0.9,
        "page_number": 2,
    }

    class FakePlan:
        labels = ["explanation"]
        required_facets = ["definition"]
        queries = ["explain RNN simply"]

        def to_dict(self):
            return {"labels": self.labels, "required_facets": self.required_facets}

    monkeypatch.setattr(main.db, "list_documents", lambda: [{"id": "doc-1"}])
    monkeypatch.setattr(
        main,
        "classify_intent",
        lambda *args, **kwargs: {
            "intent": "DOCUMENT_FOLLOW_UP",
            "confidence": 0.9,
            "method": "rule",
        },
    )
    monkeypatch.setattr(
        main,
        "rewrite_follow_up_query",
        lambda query, **kwargs: {
            "original_query": query,
            "rewritten_query": "Explain RNN simply",
            "was_rewritten": True,
            "referenced_topic": "RNN",
            "method": "rule",
        },
    )
    monkeypatch.setattr(main, "plan_retrieval", lambda query: FakePlan())
    monkeypatch.setattr(main, "generate_embeddings", lambda queries: [[0.0] for _ in queries])
    monkeypatch.setattr(main.db, "search_similar_chunks", lambda **kwargs: [chunk])
    monkeypatch.setattr(main, "reciprocal_rank_fusion", lambda result_sets: result_sets[0])
    monkeypatch.setattr(
        main,
        "check_required_facets",
        lambda *_: {"missing": []},
    )

    def fake_generate_rag_answer(**kwargs):
        seen.update(kwargs)
        return {
            "answer": "RNNs process sequential input [EXCERPT 1].",
            "model_used": "test-model",
            "chunks_used": 1,
            "citations": [],
        }

    monkeypatch.setattr(main, "generate_rag_answer", fake_generate_rag_answer)

    response = main.ask_question(
        RagAskRequest(
            query="Explain it simply",
            conversation_history=[
                {"sender": "user", "text": "Explain RNN"},
                {"sender": "assistant", "text": "RNNs process sequences."},
            ],
        )
    )

    assert response.query == "Explain it simply"
    assert response.answer.startswith("RNNs process sequential input")
    assert seen["query"] == "Explain RNN simply"
    assert seen["intent"] == "DOCUMENT_FOLLOW_UP"
    assert "Explain RNN" in seen["conversation_context"]
    assert response.question_plan["query_rewrite"]["was_rewritten"] is True


def test_comprehensive_request_retrieves_selected_document_in_source_order(
    monkeypatch,
) -> None:
    seen = {}
    chunks = [
        {
            "chunk_id": 2,
            "document_id": DOCUMENT_ID,
            "filename": "assignment.pdf",
            "chunk_index": 1,
            "content": "Second section",
            "similarity": -0.1,
            "page_number": 2,
        },
        {
            "chunk_id": 1,
            "document_id": DOCUMENT_ID,
            "filename": "assignment.pdf",
            "chunk_index": 0,
            "content": "First section",
            "similarity": 0.1,
            "page_number": 1,
        },
    ]

    class FakePlan:
        labels = ["explanation"]
        required_facets = []
        queries = ["explain entire document"]

        def to_dict(self):
            return {"labels": self.labels, "required_facets": self.required_facets}

    monkeypatch.setattr(
        main.db,
        "list_documents",
        lambda: [{"id": DOCUMENT_ID, "chunk_count": 2}],
    )
    monkeypatch.setattr(
        main.db,
        "get_document",
        lambda document_id: {"id": DOCUMENT_ID},
    )
    monkeypatch.setattr(
        main,
        "classify_intent",
        lambda *args, **kwargs: {
            "intent": "DOCUMENT_EXTRACTION",
            "confidence": 0.8,
            "method": "rule",
        },
    )
    monkeypatch.setattr(
        main,
        "rewrite_follow_up_query",
        lambda query, **kwargs: {
            "original_query": query,
            "rewritten_query": query,
            "was_rewritten": False,
            "method": "rule",
        },
    )
    monkeypatch.setattr(main, "plan_retrieval", lambda query: FakePlan())
    monkeypatch.setattr(main, "generate_embeddings", lambda queries: [[0.0] for _ in queries])

    def fake_search(**kwargs):
        seen["search"] = kwargs
        return chunks

    monkeypatch.setattr(main.db, "search_similar_chunks", fake_search)
    monkeypatch.setattr(
        main,
        "check_required_facets",
        lambda *_: {"missing": []},
    )

    def fake_generate_rag_answer(**kwargs):
        seen.update(kwargs)
        seen["ordered_chunk_indexes"] = [
            chunk["chunk_index"] for chunk in kwargs["retrieved_chunks"]
        ]
        return {
            "answer": "The document starts with its first section [EXCERPT 1, p. 1].",
            "model_used": "test-model",
            "chunks_used": len(kwargs["retrieved_chunks"]),
            "citations": [],
        }

    monkeypatch.setattr(main, "generate_rag_answer", fake_generate_rag_answer)

    response = main.ask_question(
        RagAskRequest(
            query="Explain the entire PDF",
            document_id=DOCUMENT_ID,
            top_k=1,
        )
    )

    assert seen["search"]["top_k"] == 2
    assert str(seen["search"]["document_id"]) == DOCUMENT_ID
    assert seen["search"]["min_similarity"] == -1.0
    assert seen["ordered_chunk_indexes"] == [0, 1]
    assert seen["comprehensive_document"] is True
    assert response.chunks_used == 2


def test_comprehensive_request_requires_selected_document() -> None:
    try:
        main.ask_question(RagAskRequest(query="Explain the entire PDF"))
    except HTTPException as exc:
        assert exc.status_code == 422
        assert "Select the document" in exc.detail
    else:
        raise AssertionError("Expected a selected-document validation error")


def test_legacy_rag_endpoint_retrieves_all_selected_document_chunks(
    monkeypatch,
) -> None:
    from app import main as legacy_main

    seen = {}
    chunks = [
        {
            "chunk_id": 2,
            "document_id": DOCUMENT_ID,
            "filename": "assignment.pdf",
            "chunk_index": 1,
            "content": "Second section",
            "similarity": -0.1,
            "page_number": 2,
        },
        {
            "chunk_id": 1,
            "document_id": DOCUMENT_ID,
            "filename": "assignment.pdf",
            "chunk_index": 0,
            "content": "First section",
            "similarity": 0.1,
            "page_number": 1,
        },
    ]

    class FakePlan:
        labels = ["explanation"]
        required_facets = []
        queries = ["explain entire document"]

        def to_dict(self):
            return {"labels": self.labels, "required_facets": self.required_facets}

    class FakeEmbeddingModel:
        def encode(self, *_args, **_kwargs):
            return [[0.0]]

    monkeypatch.setattr(
        legacy_main.db,
        "list_documents",
        lambda: [{"id": DOCUMENT_ID, "chunk_count": 2}],
    )
    monkeypatch.setattr(
        legacy_main,
        "get_embedding_model",
        lambda: FakeEmbeddingModel(),
    )
    monkeypatch.setattr(legacy_main, "plan_retrieval", lambda query: FakePlan())

    def fake_search(**kwargs):
        seen["search"] = kwargs
        return chunks

    monkeypatch.setattr(legacy_main.db, "search_similar_chunks", fake_search)
    monkeypatch.setattr(
        legacy_main,
        "check_required_facets",
        lambda *_: {"missing": []},
    )

    def fake_generate_rag_answer(**kwargs):
        seen.update(kwargs)
        seen["ordered_chunk_indexes"] = [
            chunk["chunk_index"] for chunk in kwargs["retrieved_chunks"]
        ]
        return {
            "answer": "The document starts with its first section [EXCERPT 1, p. 1].",
            "model_used": "test-model",
            "chunks_used": len(kwargs["retrieved_chunks"]),
            "citations": [],
        }

    monkeypatch.setattr(
        legacy_main.llm,
        "generate_rag_answer",
        fake_generate_rag_answer,
    )
    response = legacy_main.ask_question(
        legacy_main.RagAskRequest(
            query="Explain the entire PDF",
            document_id=DOCUMENT_ID,
            top_k=1,
        )
    )

    assert seen["search"]["top_k"] == 2
    assert str(seen["search"]["document_id"]) == DOCUMENT_ID
    assert seen["search"]["min_similarity"] == -1.0
    assert seen["ordered_chunk_indexes"] == [0, 1]
    assert seen["comprehensive_document"] is True
    assert response.chunks_used == 2
