from backend import main
from backend.models.schemas import RagAskRequest


def test_rag_endpoint_uses_rewritten_query_and_follow_up_context(monkeypatch) -> None:
    seen = {}
    chunk = {
        "chunk_id": 1,
        "document_id": "doc-1",
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
