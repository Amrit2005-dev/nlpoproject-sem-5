"""Google Gemini REST API client shared by the RAG and study features."""

from __future__ import annotations

import logging
import os
from typing import Any
from urllib.parse import quote

import requests

from backend.config import (
    DEFAULT_MODEL,
    GEMINI_API_KEY,
    GEMINI_BASE_URL,
)

logger = logging.getLogger(__name__)
GEMINI_TIMEOUT_SECONDS = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "30"))


def _error_message(response: requests.Response, api_key: str = "") -> str:
    try:
        message = response.json().get("error", {}).get("message", response.text)
    except (ValueError, AttributeError):
        message = response.text
    safe_message = str(message)
    for secret in {GEMINI_API_KEY, api_key} - {""}:
        safe_message = safe_message.replace(secret, "[redacted]")
    return safe_message


def call_gemini(
    messages: list[dict[str, str]],
    model: str | None = None,
    api_key: str | None = None,
    temperature: float = 0.1,
    max_tokens: int = 1000,
    timeout: float = GEMINI_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """Call Gemini generateContent and normalize its result for existing callers."""
    effective_key = (api_key or GEMINI_API_KEY).strip()
    if not effective_key:
        raise ValueError(
            "Gemini API key is missing. Set GEMINI_API_KEY in the backend .env file."
        )

    model_name = (model or DEFAULT_MODEL).strip()
    if model_name.startswith("models/"):
        model_name = model_name.removeprefix("models/")
    endpoint = (
        f"{GEMINI_BASE_URL.rstrip('/')}/models/"
        f"{quote(model_name, safe='')}:generateContent"
    )

    system_parts: list[str] = []
    contents: list[dict[str, Any]] = []
    for message in messages:
        text = message.get("content", "")
        if not isinstance(text, str) or not text.strip():
            continue
        role = message.get("role", "user")
        if role == "system":
            system_parts.append(text)
            continue

        gemini_role = "model" if role == "assistant" else "user"
        if contents and contents[-1]["role"] == gemini_role:
            contents[-1]["parts"][0]["text"] += f"\n\n{text}"
        else:
            contents.append({"role": gemini_role, "parts": [{"text": text}]})

    if not contents:
        raise ValueError("Gemini request must contain at least one user or assistant message.")
    if contents[0]["role"] != "user":
        contents.insert(0, {"role": "user", "parts": [{"text": "Continue the conversation."}]})

    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        },
    }
    if system_parts:
        payload["systemInstruction"] = {"parts": [{"text": "\n\n".join(system_parts)}]}

    response = requests.post(
        endpoint,
        headers={"x-goog-api-key": effective_key, "Content-Type": "application/json"},
        json=payload,
        timeout=timeout,
    )
    if not response.ok:
        raise RuntimeError(
            f"Gemini API error ({response.status_code}): {_error_message(response, effective_key)}"
        )

    data = response.json()
    candidates = data.get("candidates", [])
    parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
    content = "\n".join(
        part["text"] for part in parts if isinstance(part.get("text"), str)
    ).strip()
    if not content:
        reason = candidates[0].get("finishReason", "no candidate content") if candidates else "no candidates"
        raise RuntimeError(f"Gemini returned no text content ({reason}).")

    usage = data.get("usageMetadata", {})
    prompt_tokens = usage.get("promptTokenCount") or 0
    completion_tokens = usage.get("candidatesTokenCount") or 0
    return {
        "choices": [{"message": {"content": content}}],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": usage.get(
                "totalTokenCount",
                prompt_tokens + completion_tokens,
            ),
        },
    }


def verify_gemini_api_key(
    api_key: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    """Check that the configured Gemini key can access the selected model."""
    effective_key = (api_key or GEMINI_API_KEY).strip()
    if not effective_key:
        return {"valid": False, "error": "No Gemini API key configured"}

    model_name = (model or DEFAULT_MODEL).strip()
    if model_name.startswith("models/"):
        model_name = model_name.removeprefix("models/")
    endpoint = f"{GEMINI_BASE_URL.rstrip('/')}/models/{quote(model_name, safe='')}"
    try:
        response = requests.get(
            endpoint,
            headers={"x-goog-api-key": effective_key},
            timeout=10,
        )
    except requests.RequestException as exc:
        logger.warning("Gemini key verification request failed: %s", type(exc).__name__)
        return {"valid": False, "error": "Could not connect to the Gemini API"}

    if response.ok:
        return {"valid": True, "model": model_name, "provider": "Google Gemini"}
    error = _error_message(response, effective_key)
    return {"valid": False, "error": f"HTTP {response.status_code}: {error}"}
