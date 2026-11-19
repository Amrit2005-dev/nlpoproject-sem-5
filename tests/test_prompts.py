from backend.prompts import (
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

    monkeypatch.setattr(generator, "call_openrouter", fake_openrouter)
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
