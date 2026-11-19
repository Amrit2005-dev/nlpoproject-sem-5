from backend.typo_handler import correct_typos, normalize_query


def test_common_academic_typo_is_corrected() -> None:
    result = correct_typos("Explain architechture in detail")

    assert result["corrected"] == "Explain architecture in detail"
    assert result["was_corrected"] is True


def test_fuzzy_matching_does_not_change_common_words() -> None:
    query = "How does the network work?"

    assert correct_typos(query)["corrected"] == query


def test_normalization_preserves_known_abbreviations() -> None:
    assert normalize_query("Explain RNN, and TF-IDF, please!") == (
        "explain RNN and TF-IDF please"
    )
