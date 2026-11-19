from backend.prompts import (
    COMPREHENSIVE_DOCUMENT_PROMPT,
    build_user_prompt,
    get_prompt_for_intent,
)
from backend.rag import generator


def test_viva_prompt_is_selected_for_educational_assistance() -> None:
    prompt = get_prompt_for_intent("EDUCATIONAL_ASSISTANCE", is_viva=True)

    assert "viva/oral examination" in prompt
    assert "[EXCERPT #]" in prompt


def test_document_explanation_prompt_uses_requested_style() -> None:
    prompt = get_prompt_for_intent(
        "DOCUMENT_EXPLANATION",
        explanation_style="simple",
    )

    assert "experienced, patient professor" in prompt


def test_user_prompt_includes_context_and_evidence_metadata() -> None:
    prompt = build_user_prompt(
        query="Explain RNN",
        context_text="[EXCERPT 1] RNNs process sequences.",
        question_plan={
            "labels": ["explanation"],
            "required_facets": ["definition"],
            "evidence_check": {"missing": ["example"]},
        },
        conversation_context="User: Explain CNN",
        explanation_style="simple",
    )

    assert "DOCUMENT EXCERPTS:" in prompt
    assert "CONVERSATION CONTEXT" in prompt
    assert "INTERNAL UNSUPPORTED FACETS" in prompt
    assert 'EXPLANATION STYLE REQUESTED: "simple"' in prompt


def test_rag_generator_uses_mode_prompt_and_conversation_context(monkeypatch) -> None:
    calls = []

    def fake_openrouter(**kwargs):
        calls.append(kwargs)
        return {
            "choices": [
                {"message": {"content": "RNNs process sequential input [EXCERPT 1]."}}
            ]
        }

    monkeypatch.setattr(generator, "call_gemini_api", fake_openrouter)
    result = generator.generate_rag_answer(
        query="Explain RNN simply",
        retrieved_chunks=[
            {
                "chunk_id": 1,
                "document_id": "doc-1",
                "filename": "notes.pdf",
                "chunk_index": 0,
                "content": "RNNs process sequential input.",
                "similarity": 0.9,
                "page_number": 2,
            }
        ],
        api_key="test-key",
        intent="DOCUMENT_EXPLANATION",
        explanation_style="simple",
        conversation_context="User: Explain RNN",
    )

    messages = calls[0]["messages"]
    assert "experienced, patient professor" in messages[0]["content"]
    assert "STRICTLY and ONLY using the provided document excerpts" in messages[0]["content"]
    assert "CONVERSATION CONTEXT" in messages[1]["content"]
    assert "RNNs process sequential input" in messages[1]["content"]
    assert result["model_used"]
    assert result["citations"][0]["page_number"] == 2


def test_comprehensive_generation_uses_complete_document_prompt_and_citations(
    monkeypatch,
) -> None:
    calls = []

    def fake_gemini(**kwargs):
        calls.append(kwargs)
        return {
            "choices": [
                {
                    "message": {
                        "content": "The topic is introduced here [EXCERPT 1, p. 2]."
                    }
                }
            ]
        }

    monkeypatch.setattr(generator, "call_gemini_api", fake_gemini)
    result = generator.generate_rag_answer(
        query="Explain the entire PDF",
        retrieved_chunks=[
            {
                "chunk_id": 1,
                "document_id": "doc-1",
                "filename": "notes.pdf",
                "chunk_index": 0,
                "content": "The topic is introduced here.",
                "similarity": 0.1,
                "page_number": 2,
            }
        ],
        api_key="test-key",
        intent="DOCUMENT_EXPLANATION",
        comprehensive_document=True,
    )

    assert COMPREHENSIVE_DOCUMENT_PROMPT in calls[0]["messages"][0]["content"]
    assert "original order" in calls[0]["messages"][0]["content"]
    assert "complete, concise outline" in calls[0]["messages"][0]["content"]
    assert calls[0]["max_tokens"] == 8192
    assert result["citations"][0]["page_number"] == 2


def test_legacy_llm_uses_comprehensive_prompt_and_verified_page_citation(
    monkeypatch,
) -> None:
    from app import llm as legacy_llm

    calls = []

    def fake_gemini(**kwargs):
        calls.append(kwargs)
        return {
            "choices": [
                {"message": {"content": "The topic starts here [EXCERPT 1, p. 2]."}}
            ]
        }

    monkeypatch.setattr(legacy_llm, "call_gemini_api", fake_gemini)
    result = legacy_llm.generate_rag_answer(
        query="Explain the entire PDF",
        retrieved_chunks=[
            {
                "chunk_id": 1,
                "document_id": "doc-1",
                "filename": "notes.pdf",
                "chunk_index": 0,
                "content": "The topic starts here.",
                "similarity": 0.1,
                "page_number": 2,
            }
        ],
        api_key="test-key",
        comprehensive_document=True,
    )

    assert "complete, concise outline" in calls[0]["messages"][0]["content"]
    assert calls[0]["max_tokens"] == 8192
    assert result["citations"][0]["page_number"] == 2
