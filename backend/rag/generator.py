"""RAG Answer Generator & Citation Resolver:
Queries OpenRouter models with strict anti-hallucination document grounding and
resolves verified, page-level source citations.
"""

import logging
import os
import re
from typing import Any
import requests

from backend.config import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    DEFAULT_MODEL,
    UNIQUE_FALLBACK_MODELS,
)

logger = logging.getLogger(__name__)


def _clean_user_answer(content: Any) -> str:
    """Remove model reasoning traces and return only the final answer."""
    if not isinstance(content, str):
        return ""
    text = content.strip()
    text = re.sub(r"(?is)<think>.*?</think>", "", text).strip()
    text = re.sub(r"(?is)<analysis>.*?</analysis>", "", text).strip()
    if re.match(r"(?i)^here(?:'s| is)\s+(?:a\s+)?thinking\s+process", text):
        return ""
    if re.match(r"(?i)^analysis\s*[:\n]", text):
        return ""
    return text.strip()

SYSTEM_PROMPT = """You are a precise, truth-grounded Question Answering assistant for lecture notes and documents.
Your task is to answer the user's question STRICTLY and ONLY using the provided document excerpts below.

STRICT GROUNDING & CITATION RULES:
1. Rely ONLY on the clear facts stated in the provided context excerpts.
2. Do NOT extrapolate, speculate, or introduce external knowledge.
3. If the context does not contain enough information to answer the question, you MUST clearly state:
   "The provided document does not contain this information."
4. Whenever you make a factual statement, cite the supporting excerpt using its label, e.g. [EXCERPT 1] or [EXCERPT 2].
5. Do NOT invent page numbers, filenames, section titles, or URLs. Only cite the supplied [EXCERPT #] label.
6. Keep your answer clear, well-structured, and concise.
NEVER include chain-of-thought, analysis, planning steps, or internal labels in the response.
Return only the final user-facing answer.
"""


def format_context_for_prompt(chunks: list[dict[str, Any]]) -> str:
    """Format retrieved document chunks into clean context blocks with page and section metadata."""
    if not chunks:
        return "No relevant context found in the document store."

    parts = []
    for i, chunk in enumerate(chunks, 1):
        filename = chunk.get("filename", "Document")
        chunk_idx = chunk.get("chunk_index", i - 1)
        similarity = chunk.get("similarity", 0.0)
        content = chunk.get("content", "").strip()

        page_num = chunk.get("page_number", 1)
        sec_title = chunk.get("section_title")
        page_info = f" | Page: {page_num}"
        sec_info = f" | Section: {sec_title}" if sec_title else ""

        # Preserves "Source: {filename} | Chunk: {chunk_idx}" for backwards compatibility with tests
        part = (
            f"--- [EXCERPT {i}] Source: {filename} | Chunk: {chunk_idx}{page_info}{sec_info} | Relevance: {similarity:.2f} ---\n"
            f"{content}\n"
        )
        parts.append(part)

    return "\n".join(parts)


def resolve_citations(
    answer: str,
    retrieved_chunks: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Map answer claims and cited excerpt labels back to verified retrieved chunks.
    Validates all citations against genuine retrieved chunks to prevent hallucinated citations.
    """
    if not retrieved_chunks:
        return []

    cited_indices: list[int] = []

    # Match [EXCERPT 1] or [EXCERPT #1]
    matches = re.findall(r"\[(?:EXCERPT|Excerpt|excerpt)\s*#?(\d+)\]", answer)
    for m in matches:
        try:
            val = int(m)
            if 1 <= val <= len(retrieved_chunks):
                if (val - 1) not in cited_indices:
                    cited_indices.append(val - 1)
        except ValueError:
            pass

    # Match [Chunk 0] or [Chunk #0]
    chunk_matches = re.findall(r"\[(?:CHUNK|Chunk|chunk)\s*#?(\d+)\]", answer)
    for cm in chunk_matches:
        try:
            c_val = int(cm)
            for idx, ch in enumerate(retrieved_chunks):
                if ch.get("chunk_index") == c_val or ch.get("chunk_id") == c_val:
                    if idx not in cited_indices:
                        cited_indices.append(idx)
                    break
        except ValueError:
            pass

    # Fallback heuristic: If the LLM didn't emit explicit [EXCERPT #] tags,
    # find which retrieved chunks have key phrase overlap with the answer text.
    if not cited_indices:
        lower_answer = answer.lower()
        if "not contain this information" not in lower_answer:
            for idx, ch in enumerate(retrieved_chunks):
                content = ch.get("content", "")
                words = [w.strip(".,;:()") for w in content.split() if len(w) > 3]
                matches_count = sum(1 for w in words[:20] if w.lower() in lower_answer)
                if matches_count >= 3:
                    cited_indices.append(idx)

        if not cited_indices and "not contain this information" not in lower_answer and retrieved_chunks:
            cited_indices.append(0)

    # Build validated citation objects
    citations: list[dict[str, Any]] = []
    seen_refs = set()

    for cite_num, chunk_pos in enumerate(cited_indices, 1):
        if chunk_pos >= len(retrieved_chunks):
            continue

        chunk = retrieved_chunks[chunk_pos]
        doc_id = str(chunk.get("document_id", ""))
        page_num = int(chunk.get("page_number", 1) or 1)
        page_end = int(chunk.get("page_end", page_num) or page_num)
        chunk_id = chunk.get("chunk_id", chunk.get("chunk_index", 0))

        ref_key = (doc_id, page_num, chunk.get("chunk_index"))
        if ref_key in seen_refs:
            continue
        seen_refs.add(ref_key)

        content = chunk.get("content", "").strip()
        sentences = re.split(r"(?<=[.!?])\s+", content)
        quoted_text = " ".join(sentences[:2]) if sentences else content[:220]
        if len(quoted_text) > 280:
            quoted_text = quoted_text[:280] + "..."

        open_url = f"/documents/{doc_id}/file#page={page_num}" if doc_id else ""

        citations.append(
            {
                "citation_id": f"cite-{cite_num}",
                "chunk_id": chunk_id,
                "document_id": doc_id,
                "document_name": chunk.get("filename", "Document"),
                "page_number": page_num,
                "page_end": page_end,
                "section_title": chunk.get("section_title"),
                "quoted_text": quoted_text,
                "start_char": chunk.get("start_char", 0),
                "end_char": chunk.get("end_char", len(content)),
                "open_url": open_url,
            }
        )

    return citations


def call_openrouter(
    messages: list[dict[str, str]],
    model: str,
    api_key: str,
    temperature: float = 0.1,
    max_tokens: int = 1000,
    timeout: float = 45,
) -> dict[str, Any]:
    """Call OpenRouter Chat Completions endpoint."""
    url = f"{OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://localhost:5173",
        "X-Title": "PDF RAG Assistant",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    response = requests.post(url, headers=headers, json=payload, timeout=timeout)
    if response.status_code != 200:
        error_detail = response.text
        try:
            err_json = response.json()
            error_detail = err_json.get("error", {}).get("message", response.text)
        except Exception:
            pass
        raise RuntimeError(f"OpenRouter error ({response.status_code}): {error_detail}")

    return response.json()


def generate_rag_answer(
    query: str,
    retrieved_chunks: list[dict[str, Any]],
    model: str | None = None,
    api_key: str | None = None,
    temperature: float = 0.1,
    question_labels: list[str] | None = None,
    required_facets: list[str] | None = None,
    missing_facets: list[str] | None = None,
) -> dict[str, Any]:
    """
    Generate an answer using OpenRouter with strict document grounding and verified citations.
    Automatically falls back across reliable free models if rate-limited.
    """
    effective_key = (api_key or OPENROUTER_API_KEY).strip()
    if not effective_key:
        raise ValueError(
            "OpenRouter API key is missing. Please set OPENROUTER_API_KEY in .env or provide it in the request."
        )

    context_text = format_context_for_prompt(retrieved_chunks)

    labels_text = ", ".join(question_labels or []) or "general"
    facets_text = ", ".join(required_facets or []) or "answer all parts of the question"
    missing_text = ", ".join(missing_facets or []) or "none"
    user_prompt = (
        f"DOCUMENT EXCERPTS:\n"
        f"================================================\n"
        f"{context_text}\n"
        f"================================================\n\n"
        f"USER QUESTION: {query}\n"
        f"INTERNAL QUESTION TYPE (do not echo this label): {labels_text}\n"
        f"INTERNAL REQUIRED FACETS (do not echo these labels): {facets_text}\n"
        f"INTERNAL UNSUPPORTED FACETS (do not echo these labels): {missing_text}\n\n"
        f"INSTRUCTION: Answer using only the supplied excerpts and cover every requested facet. "
        f"Write in the user's language style. For comparisons, cover both items and then the contrast. "
        f"For algorithms, give ordered steps. For numerical questions, state formula, substitution, and result. "
        f"Do not invent missing facts. Whenever a factual claim is supported by an excerpt, cite it using [EXCERPT #]. "
        f"For unsupported facets, explicitly state that the provided document does not contain sufficient evidence."
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    candidate_models = []
    if model:
        candidate_models.append(model)
    for fb in UNIQUE_FALLBACK_MODELS:
        if fb not in candidate_models:
            candidate_models.append(fb)

    last_error = None
    for target_model in candidate_models:
        try:
            logger.info("Calling OpenRouter with model: %s", target_model)
            res_json = call_openrouter(
                messages=messages,
                model=target_model,
                api_key=effective_key,
                temperature=temperature,
            )
            choices = res_json.get("choices", [])
            if not choices:
                raise RuntimeError("OpenRouter returned empty choices.")

            msg = choices[0].get("message", {})
            content = _clean_user_answer(msg.get("content"))
            if not content:
                logger.warning("Model %s returned reasoning or no final answer; trying the next model", target_model)
                continue
            usage = res_json.get("usage", {})

            citations = resolve_citations(content, retrieved_chunks)

            return {
                "answer": content,
                "model_used": target_model,
                "chunks_used": len(retrieved_chunks),
                "citations": citations,
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            }
        except Exception as exc:
            logger.warning("Model %s failed: %s. Trying next candidate...", target_model, exc)
            last_error = exc
            continue

    raise RuntimeError(f"All LLM models failed. Last error: {last_error}")


def verify_api_key(api_key: str | None = None) -> dict[str, Any]:
    """Verify that the OpenRouter API key is valid and check credit/rate limits."""
    effective_key = (api_key or OPENROUTER_API_KEY).strip()
    if not effective_key:
        return {"valid": False, "error": "No API key configured"}

    url = f"{OPENROUTER_BASE_URL.rstrip('/')}/auth/key"
    try:
        res = requests.get(
            url,
            headers={"Authorization": f"Bearer {effective_key}"},
            timeout=10,
        )
        if res.status_code == 200:
            data = res.json().get("data", {})
            return {
                "valid": True,
                "label": data.get("label", "Key"),
                "is_free_tier": data.get("is_free_tier", True),
                "free_daily_remaining": data.get("free_model_daily_requests", {}).get("remaining", "unknown"),
                "limit_usd": data.get("limit", 0),
            }
        return {"valid": False, "error": f"HTTP {res.status_code}: {res.text}"}
    except Exception as exc:
        return {"valid": False, "error": str(exc)}
