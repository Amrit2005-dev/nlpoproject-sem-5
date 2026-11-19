"""Hybrid intent classification for conversational AI + RAG document assistant.

Combines fast rule-based pattern matching (for obvious intents) with an
LLM fallback (via Gemini) for ambiguous queries.  Supports English
and Hinglish patterns throughout.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from backend.config import GEMINI_API_KEY, UNIQUE_FALLBACK_MODELS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 1. Intent constants
# ---------------------------------------------------------------------------

INTENTS: list[str] = [
    "NORMAL_CONVERSATION",
    "DOCUMENT_QUESTION",
    "DOCUMENT_SUMMARIZATION",
    "DOCUMENT_EXPLANATION",
    "DOCUMENT_EXTRACTION",
    "DOCUMENT_FOLLOW_UP",
    "GENERAL_KNOWLEDGE",
    "EDUCATIONAL_ASSISTANCE",
    "AMBIGUOUS_QUERY",
]

_VALID_INTENTS: set[str] = set(INTENTS)

# ---------------------------------------------------------------------------
# 2. Rule-based classifier
# ---------------------------------------------------------------------------

# --- Greeting patterns ---
_GREETINGS: set[str] = {
    "hi", "hii", "hiii", "hy", "hello", "hey", "hola", "namaste",
    "good morning", "good afternoon", "good evening", "good night",
    "sup", "yo", "howdy", "assalamualaikum", "namaskar",
}
_GREETING_PREFIXES: tuple[str, ...] = (
    "hi ", "hii ", "hiii ", "hy ", "hello ", "hey ", "hola ",
    "namaste ", "good morning", "good afternoon", "good evening",
)

# --- Identity patterns ---
_IDENTITY: set[str] = {
    "who are you", "what are you", "what can you do", "help",
    "who r u", "what r u", "tum kaun ho", "aap kaun ho",
    "kya kar sakte ho", "tumhara naam kya hai",
}

# --- Courtesy patterns ---
_COURTESY: set[str] = {
    "thanks", "thank you", "thankyou", "thanks a lot", "ty",
    "dhanyawad", "dhanyavaad", "shukriya", "shukriyaa",
    "bye", "goodbye", "see you", "see ya", "alvida", "khuda hafiz",
}

# --- Status patterns ---
_STATUS: set[str] = {
    "how are you", "how r u", "how you doing", "whats up", "what is up",
    "kaise ho", "kya haal hai", "kya chal raha hai", "sab theek",
}

# --- Date / time patterns ---
_DATE_KEYWORDS: list[str] = [
    "what is date", "what is today date", "what is the date", "whats the date",
    "what date is today", "what date is it", "todays date", "today date",
    "current date", "what is todays date", "date today", "tell me the date",
    "tell me date", "aaj ki date", "tarikh", "aaj ki tarikh",
]
_TIME_KEYWORDS: list[str] = [
    "what is time", "what is current time", "whats the time",
    "what is the time", "current time", "what time is it",
    "tell me the time", "time now", "samay", "waqt", "kitne baje",
]

# --- Viva / educational patterns ---
_EDUCATIONAL_RE = re.compile(
    r"\b("
    r"viva|practical viva|oral exam|lab exam|interview prep|"
    r"exam preparation|exam prep|quiz|mock test|practice questions|"
    r"viva ke liye|viva questions|exam ke questions|paper mein aayega|"
    r"important questions|imp questions|expected questions|guess paper|"
    r"revision|revise karo|padhai|tayyari"
    r")\b",
    re.IGNORECASE,
)

# --- Summarization patterns ---
_SUMMARIZE_RE = re.compile(
    r"\b("
    r"summarize|summarise|summary|overview|brief|short notes|gist|synopsis|"
    r"saaransh|summary de do|short mein batao|chhota karke batao|"
    r"ek line mein|nutshell"
    r")\b",
    re.IGNORECASE,
)

# --- Extraction patterns ---
_EXTRACTION_RE = re.compile(
    r"\b("
    r"extract|list all|give me all|find all|what are the|table of contents|"
    r"all the|enumerate|nikalo|sabhi batao|"
    r"page\s*\d|slide\s*\d|section\s*\d|chapter\s*\d"
    r")\b",
    re.IGNORECASE,
)

# --- Follow-up starters ---
_FOLLOW_UP_STARTS_RE = re.compile(
    r"^(it\b|its\b|this\b|that\b|these\b|those\b|the above\b|"
    r"previous\b|next one\b|iska\b|uska\b|ye\b|wo\b|woh\b|"
    r"pichla\b|agla\b|ispe\b|uspe\b|and\b|also\b|more about\b|"
    r"what about\b|how about\b|tell me more\b)",
    re.IGNORECASE,
)
_FOLLOW_UP_PHRASE_RE = re.compile(
    r"^(give\s+me\s+an?\s+example|in\s+more\s+detail|more\s+detail|"
    r"detail\s+please|explain\s+(it|this|that)\s+simply|"
    r"iska\s+example\s+de|detail\s+mein)\b",
    re.IGNORECASE,
)

# --- General-knowledge markers ---
_GENERAL_RE = re.compile(
    r"\b(in general|generally speaking|outside the document|"
    r"not from the document|without the document|"
    r"aam taur pe|normally)\b",
    re.IGNORECASE,
)

# --- Explanation patterns ---
_EXPLANATION_RE = re.compile(
    r"\b(explain|explanation|elaborate|teach|samjhao|samjha do|detail mein|"
    r"describe|describe karo|vishleshan)\b",
    re.IGNORECASE,
)

_COMPREHENSIVE_EXPLANATION_RE = re.compile(
    r"\b(?:explain|teach|walk\s+me\s+through|go\s+through|cover)\b"
    r".{0,100}\b(?:all|every|entire|whole|everything|complete|full)\b"
    r"|\b(?:explain|teach|walk\s+me\s+through|go\s+through|cover)\b"
    r".{0,60}\b(?:this|the)\s+(?:pdf|document|assignment|syllabus)\b",
    re.IGNORECASE,
)


def is_comprehensive_explanation_request(text: str) -> bool:
    """Return whether the user asks for an explanation of the complete document."""
    return bool(text and _COMPREHENSIVE_EXPLANATION_RE.search(text))


def _make_result(
    intent: str,
    confidence: float,
    sub_type: str | None = None,
) -> dict[str, Any]:
    """Build a standardised classification result dict."""
    result: dict[str, Any] = {
        "intent": intent,
        "confidence": round(confidence, 2),
        "method": "rule",
    }
    if sub_type:
        result["sub_type"] = sub_type
    return result


def rule_classify(
    text: str,
    has_documents: bool,
    conversation_history: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    """Fast pattern-matching classifier for obvious intents.

    Returns a classification dict or ``None`` when the query needs the
    LLM-based classifier.

    Parameters
    ----------
    text:
        The raw user query.
    has_documents:
        Whether the user has uploaded documents in the current session.
    conversation_history:
        List of prior messages (each with at least a ``"text"`` key).
    """
    if not isinstance(text, str) or not text.strip():
        return _make_result("NORMAL_CONVERSATION", 0.95, sub_type="empty")

    t = text.strip().lower()
    t_clean = re.sub(r"[^\w\s]", "", t).strip()

    # ---- NORMAL_CONVERSATION: greetings ----
    if t_clean in _GREETINGS or any(t_clean.startswith(p) for p in _GREETING_PREFIXES):
        return _make_result("NORMAL_CONVERSATION", 0.95, sub_type="greeting")

    # ---- NORMAL_CONVERSATION: identity ----
    if t_clean in _IDENTITY:
        return _make_result("NORMAL_CONVERSATION", 0.95, sub_type="identity")

    # ---- NORMAL_CONVERSATION: courtesy ----
    if t_clean in _COURTESY:
        return _make_result("NORMAL_CONVERSATION", 0.95, sub_type="courtesy")

    # ---- NORMAL_CONVERSATION: status ----
    if t_clean in _STATUS:
        return _make_result("NORMAL_CONVERSATION", 0.95, sub_type="status")

    # ---- NORMAL_CONVERSATION: date ----
    if any(p in t_clean for p in _DATE_KEYWORDS) or t_clean in {"date", "todays date"}:
        return _make_result("NORMAL_CONVERSATION", 0.95, sub_type="date")

    # ---- NORMAL_CONVERSATION: time ----
    if any(p in t_clean for p in _TIME_KEYWORDS) or t_clean in {"time", "current time"}:
        return _make_result("NORMAL_CONVERSATION", 0.95, sub_type="time")

    # ---- EDUCATIONAL_ASSISTANCE ----
    if _EDUCATIONAL_RE.search(t):
        return _make_result("EDUCATIONAL_ASSISTANCE", 0.90, sub_type="exam_prep")

    # Follow-ups take precedence over generic explanation wording.
    history = conversation_history or []
    if history and _FOLLOW_UP_STARTS_RE.match(t_clean):
        return _make_result("DOCUMENT_FOLLOW_UP", 0.75, sub_type="pronoun_ref")
    if history and _FOLLOW_UP_PHRASE_RE.match(t_clean):
        return _make_result("DOCUMENT_FOLLOW_UP", 0.75, sub_type="short_ref")

    # ---- DOCUMENT_SUMMARIZATION ----
    if has_documents and _SUMMARIZE_RE.search(t):
        return _make_result("DOCUMENT_SUMMARIZATION", 0.80, sub_type="summary")

    # ---- DOCUMENT_EXTRACTION ----
    if has_documents and _EXTRACTION_RE.search(t):
        return _make_result("DOCUMENT_EXTRACTION", 0.80, sub_type="extraction")

    # ---- DOCUMENT_EXPLANATION ----
    if has_documents and _EXPLANATION_RE.search(t):
        return _make_result("DOCUMENT_EXPLANATION", 0.75, sub_type="explanation")

    # Very short referential query with existing history
    word_count = len(t_clean.split())
    if history and word_count < 5 and re.search(
        r"\b(it|its|this|that|these|those|them|above|previous|same|another|"
        r"iska|uska|isme|usme|ye|wo|woh|pichla|agla)\b",
        t_clean,
    ):
        return _make_result("DOCUMENT_FOLLOW_UP", 0.70, sub_type="short_ref")
    if history and t_clean in {"more", "why", "how", "example", "give example"}:
        return _make_result("DOCUMENT_FOLLOW_UP", 0.70, sub_type="short_ref")

    # ---- GENERAL_KNOWLEDGE (explicit markers) ----
    if _GENERAL_RE.search(t):
        return _make_result("GENERAL_KNOWLEDGE", 0.80, sub_type="explicit_general")

    # ---- GENERAL_KNOWLEDGE (no documents, looks like a factual question) ----
    if not has_documents and re.match(
        r"^(what|who|when|where|why|how|define|explain|describe|kya|kaun|kab|kahan|kaise|kyun)\b",
        t_clean,
    ):
        return _make_result("GENERAL_KNOWLEDGE", 0.70, sub_type="knowledge_question")

    # Nothing matched with sufficient confidence → needs LLM
    return None


# ---------------------------------------------------------------------------
# 3. LLM-based classifier
# ---------------------------------------------------------------------------

_CLASSIFY_SYSTEM_PROMPT = (
    "You are an intent classifier. Classify the user message into exactly one "
    "category.  Reply with ONLY the category name and nothing else.\n\n"
    "Categories:\n"
    + "\n".join(f"- {intent}" for intent in INTENTS)
)


def _summarise_history(
    conversation_history: list[dict[str, Any]] | None,
    max_messages: int = 3,
) -> str:
    """Return a one-line summary of the last few messages for LLM context."""
    if not conversation_history:
        return "No prior conversation."
    recent = conversation_history[-max_messages:]
    lines: list[str] = []
    for msg in recent:
        sender = msg.get("sender", "user")
        snippet = (msg.get("text", "") or "")[:120]
        if snippet:
            lines.append(f"{sender}: {snippet}")
    return "\n".join(lines) if lines else "No prior conversation."


def llm_classify(
    text: str,
    has_documents: bool,
    conversation_history: list[dict[str, Any]] | None = None,
    api_key: str | None = None,
) -> dict[str, Any]:
    """Classify intent via a lightweight Gemini API call.

    Falls back to ``GENERAL_KNOWLEDGE`` if the LLM call fails or returns
    an unrecognised category.

    Parameters
    ----------
    text:
        The raw user query.
    has_documents:
        Whether documents are uploaded in the current session.
    conversation_history:
        List of prior messages.
    api_key:
        Optional explicit Gemini API key (falls back to env config).
    """
    # Lazy import to avoid circular dependency at module load time
    from backend.rag.generator import call_gemini_api  # noqa: WPS433

    effective_key = (api_key or GEMINI_API_KEY or "").strip()
    if not effective_key:
        fallback_intent = "DOCUMENT_QUESTION" if has_documents else "GENERAL_KNOWLEDGE"
        logger.warning("No API key available for LLM intent classification; defaulting to %s.", fallback_intent)
        return {
            "intent": fallback_intent,
            "confidence": 0.40,
            "method": "llm_fallback",
            "sub_type": "no_api_key",
        }

    history_summary = _summarise_history(conversation_history)
    user_prompt = (
        f"Documents uploaded: {has_documents}\n\n"
        f"Recent conversation context:\n{history_summary}\n\n"
        f'User message: "{text}"\n\n'
        "Reply with ONLY the category name."
    )

    messages = [
        {"role": "system", "content": _CLASSIFY_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    for model in UNIQUE_FALLBACK_MODELS:
        try:
            response = call_gemini_api(
                messages=messages,
                model=model,
                api_key=effective_key,
                temperature=0.0,
                max_tokens=50,
                timeout=15,
            )
            choices = response.get("choices", [])
            raw = (
                (choices[0].get("message", {}).get("content", "") if choices else "")
                .strip()
                .upper()
                .replace(" ", "_")
            )
            # Strip any surrounding quotes or punctuation the model may add
            raw = re.sub(r"[^A-Z_]", "", raw)

            if raw in _VALID_INTENTS:
                logger.info("LLM classified intent as %s (model=%s)", raw, model)
                return {
                    "intent": raw,
                    "confidence": 0.75,
                    "method": "llm",
                    "sub_type": None,
                }

            logger.warning(
                "LLM returned unrecognised intent '%s' (model=%s); trying next model.",
                raw,
                model,
            )
        except Exception as exc:
            logger.warning("LLM intent classification failed with model %s: %s", model, exc)

    # All models failed — safe fallback
    fallback_intent = "DOCUMENT_QUESTION" if has_documents else "GENERAL_KNOWLEDGE"
    logger.error("All LLM models failed for intent classification; defaulting to %s.", fallback_intent)
    return {
        "intent": fallback_intent,
        "confidence": 0.40,
        "method": "llm_fallback",
        "sub_type": "all_models_failed",
    }


# ---------------------------------------------------------------------------
# 4. Main entry point
# ---------------------------------------------------------------------------


def classify_intent(
    text: str,
    has_documents: bool,
    conversation_history: list[dict[str, Any]] | None = None,
    api_key: str | None = None,
) -> dict[str, Any]:
    """Classify the user's intent using rules first, then LLM for ambiguity.

    Post-processing ensures document-related intents are only returned
    when documents are actually available.

    Parameters
    ----------
    text:
        The raw user message.
    has_documents:
        Whether the session has uploaded documents.
    conversation_history:
        Prior conversation messages (list of dicts with ``"text"`` key).
    api_key:
        Optional Gemini API key override.

    Returns
    -------
    dict
        ``{"intent": str, "confidence": float, "method": str, "sub_type": str | None}``
    """
    history = conversation_history or []

    # Step 1: Try rule-based classification
    result = rule_classify(text, has_documents, history)

    # Step 2: Fall back to LLM if rules didn't match or confidence is low
    if result is None or result.get("confidence", 0) < 0.70:
        logger.info("Rule classifier returned %s — invoking LLM classifier.", result)
        llm_result = llm_classify(text, has_documents, history, api_key=api_key)
        # If the rule result existed but was low-confidence, pick the higher one
        if result is not None and result.get("confidence", 0) >= llm_result.get("confidence", 0):
            pass  # keep rule result
        else:
            result = llm_result

    # Step 3: Post-processing guards
    intent = result.get("intent", "AMBIGUOUS_QUERY")

    # Guard: document intents require documents
    if intent.startswith("DOCUMENT_") and not has_documents:
        logger.info(
            "Downgrading %s → GENERAL_KNOWLEDGE (no documents uploaded).", intent
        )
        result["intent"] = "GENERAL_KNOWLEDGE"
        result["confidence"] = min(result.get("confidence", 0.5), 0.60)
        result["sub_type"] = f"downgraded_from_{intent.lower()}"

    # Guard: follow-up needs history
    if intent == "DOCUMENT_FOLLOW_UP" and not history:
        fallback = "DOCUMENT_QUESTION" if has_documents else "GENERAL_KNOWLEDGE"
        logger.info(
            "Downgrading DOCUMENT_FOLLOW_UP → %s (no conversation history).",
            fallback,
        )
        result["intent"] = fallback
        result["confidence"] = min(result.get("confidence", 0.5), 0.60)
        result["sub_type"] = "downgraded_from_follow_up"

    return result


# ---------------------------------------------------------------------------
# 5. Explanation-style detector
# ---------------------------------------------------------------------------

_EXPLANATION_STYLES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(?:explain|describe)\b.*\bsimply\b|\b(simple mein|easy language|aasan bhasha|saral)\b", re.I), "simple"),
    (re.compile(r"\b(?:explain|describe)\b.*\b(?:in detail|detailed|elaborately)\b|\b(detail mein|vistar se)\b", re.I), "detailed"),
    (re.compile(r"\b(for viva|viva ke liye|viva style)\b", re.I), "viva"),
    (re.compile(r"\b(short notes|give short notes|brief|chhota notes)\b", re.I), "short_notes"),
    (re.compile(r"\b(give examples?|example de|udaharan|with examples?)\b", re.I), "with_examples"),
    (re.compile(r"\b(line by line|ek ek line|har line)\b", re.I), "line_by_line"),
    (re.compile(r"\b(step by step|steps mein|kadam se kadam)\b", re.I), "step_by_step"),
]


def detect_explanation_style(text: str) -> str | None:
    """Detect what style of explanation the user is requesting.

    Returns one of ``"simple"``, ``"detailed"``, ``"viva"``,
    ``"short_notes"``, ``"with_examples"``, ``"line_by_line"``,
    ``"step_by_step"``, or ``None`` if no specific style is detected.
    """
    if not text:
        return None
    for pattern, style in _EXPLANATION_STYLES:
        if pattern.search(text):
            logger.debug("Detected explanation style: %s", style)
            return style
    return None


# ---------------------------------------------------------------------------
# 6. Viva-mode detector
# ---------------------------------------------------------------------------

_VIVA_RE = re.compile(
    r"\b("
    r"viva|practical viva|oral exam|lab exam|interview prep|"
    r"exam preparation|exam prep|mock test|practice questions|"
    r"viva ke liye|viva questions|exam ke questions|paper mein aayega|"
    r"important questions|imp questions|guess paper|"
    r"expected questions|revision|tayyari"
    r")\b",
    re.IGNORECASE,
)


def detect_viva_mode(text: str) -> bool:
    """Return ``True`` if the query is about viva / exam preparation."""
    if not text:
        return False
    return bool(_VIVA_RE.search(text))
