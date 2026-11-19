from backend import gemini


class FakeResponse:
    def __init__(self, data, status_code=200, text=""):
        self._data = data
        self.status_code = status_code
        self.text = text
        self.ok = 200 <= status_code < 300

    def json(self):
        return self._data


def test_call_gemini_translates_chat_messages_and_usage(monkeypatch) -> None:
    captured = {}

    def fake_post(url, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return FakeResponse(
            {
                "candidates": [
                    {"content": {"parts": [{"text": "Grounded answer."}]}}
                ],
                "usageMetadata": {
                    "promptTokenCount": 12,
                    "candidatesTokenCount": 5,
                    "totalTokenCount": 17,
                },
            }
        )

    monkeypatch.setattr(gemini.requests, "post", fake_post)
    result = gemini.call_gemini(
        messages=[
            {"role": "system", "content": "Use the evidence."},
            {"role": "user", "content": "Question"},
            {"role": "assistant", "content": "Prior answer"},
        ],
        model="gemini-2.5-flash",
        api_key="test-secret",
        temperature=0.2,
        max_tokens=50,
    )

    assert captured["url"].endswith("/models/gemini-2.5-flash:generateContent")
    assert captured["headers"]["x-goog-api-key"] == "test-secret"
    assert captured["json"]["systemInstruction"]["parts"][0]["text"] == "Use the evidence."
    assert captured["json"]["contents"] == [
        {"role": "user", "parts": [{"text": "Question"}]},
        {"role": "model", "parts": [{"text": "Prior answer"}]},
    ]
    assert result["choices"][0]["message"]["content"] == "Grounded answer."
    assert result["usage"]["total_tokens"] == 17


def test_call_gemini_redacts_key_from_api_errors(monkeypatch) -> None:
    monkeypatch.setattr(
        gemini.requests,
        "post",
        lambda *args, **kwargs: FakeResponse(
            {"error": {"message": "Rejected test-secret"}},
            status_code=401,
        ),
    )

    try:
        gemini.call_gemini(
            [{"role": "user", "content": "Hello"}],
            api_key="test-secret",
        )
    except RuntimeError as exc:
        assert "test-secret" not in str(exc)
        assert "[redacted]" in str(exc)
    else:
        raise AssertionError("Gemini API errors should be raised")


def test_verify_gemini_key_checks_configured_model(monkeypatch) -> None:
    captured = {}

    def fake_get(url, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return FakeResponse({"name": "models/gemini-2.5-flash"})

    monkeypatch.setattr(gemini.requests, "get", fake_get)

    result = gemini.verify_gemini_api_key("test-secret", "gemini-2.5-flash")

    assert result["valid"] is True
    assert result["provider"] == "Google Gemini"
    assert captured["url"].endswith("/models/gemini-2.5-flash")
    assert captured["headers"]["x-goog-api-key"] == "test-secret"
