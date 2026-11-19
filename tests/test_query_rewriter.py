from backend.query_rewriter import needs_rewriting, rewrite_follow_up_query


def test_self_contained_question_does_not_get_rewritten() -> None:
    history = [{"sender": "user", "text": "Explain CNN"}]

    assert not needs_rewriting("What is RNN?", history)


def test_rule_rewrite_resolves_pronoun_and_style() -> None:
    history = [{"sender": "user", "text": "Explain RNN"}]

    result = rewrite_follow_up_query("Explain it simply", history, api_key="")

    assert result["was_rewritten"] is True
    assert result["rewritten_query"] == "explain RNN simply"
    assert result["method"] == "rule"


def test_rule_rewrite_adds_topic_to_example_request() -> None:
    history = [{"sender": "user", "text": "Explain CNN"}]

    result = rewrite_follow_up_query("Give me an example", history, api_key="")

    assert result["was_rewritten"] is True
    assert result["rewritten_query"] == "give me an example of CNN"


def test_topic_extraction_ignores_assistant_opening_words() -> None:
    history = [
        {"sender": "user", "text": "What is Recurrent Neural Network"},
        {"sender": "assistant", "text": "The answer is based on recurrent networks."},
    ]

    result = rewrite_follow_up_query("explain it", history, api_key="")

    assert result["referenced_topic"] == "Recurrent Neural Network"
    assert result["rewritten_query"] == "explain Recurrent Neural Network"
