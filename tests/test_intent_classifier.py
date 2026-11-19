from backend.intent_classifier import detect_explanation_style, rule_classify


def test_standalone_short_question_is_not_a_follow_up() -> None:
    history = [{"sender": "user", "text": "Explain CNN"}]

    result = rule_classify("What is RNN?", True, history)

    assert result is None


def test_referential_short_question_is_a_follow_up() -> None:
    history = [{"sender": "user", "text": "Explain CNN"}]

    result = rule_classify("Explain it simply", True, history)

    assert result is not None
    assert result["intent"] == "DOCUMENT_FOLLOW_UP"
    assert detect_explanation_style("Explain RNN simply") == "simple"


def test_failed_classifier_prefers_document_question_when_docs_exist(monkeypatch) -> None:
    from backend import intent_classifier
    from backend import config

    monkeypatch.setattr(config, "GEMINI_API_KEY", "")
    monkeypatch.setattr(intent_classifier, "GEMINI_API_KEY", "")
    result = intent_classifier.llm_classify("Explain an unfamiliar topic", True)

    assert result["intent"] == "DOCUMENT_QUESTION"
    assert result["method"] == "llm_fallback"
