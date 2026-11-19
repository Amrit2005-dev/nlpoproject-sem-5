from backend.multilingual import detect_language


def test_pure_telugu_script():
    result = detect_language("మూడవ త్రైమాసికం ఆదాయ వివరాలు చెప్పండి")
    assert result["languages"] == ["te"]
    assert result["code_mixed"] is False
    assert result["method"] == "script"


def test_mixed_script():
    result = detect_language("ఈ report లో ఏముంది cheppandi")
    assert result["languages"] == ["te", "en"]
    assert result["code_mixed"] is True


def test_romanized_telugu():
    result = detect_language("Naaku ee document lo revenue figures kavali, cheppandi")
    assert "te-rom" in result["languages"]
    assert "en" in result["languages"]


def test_romanized_hindi():
    result = detect_language("Aapko ye report kaise chahiye, PDF format mein bhejun kya?")
    assert "hi-rom" in result["languages"]
    assert "en" in result["languages"]


def test_manual_override():
    result = detect_language("Send me the report", "te-rom|en")
    assert result["languages"] == ["te-rom", "en"]
    assert result["method"] == "manual"
