"""Question segmentation and retrieval planning for Hinglish RAG questions."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Iterable


QUESTION_TYPES = (
    "definition",
    "comparison",
    "algorithm",
    "numerical",
    "example",
    "multi_part",
)

_RULES = {
    "definition": (r"\b(what|what is|define|definition|ky[aā]?|kya|matlab|meaning|means)\b", 0.85),
    "comparison": (r"\b(compare|comparison|difference|differ|versus|vs\.?|aur.*farq|difference between|beech.*difference)\b", 0.90),
    "algorithm": (r"\b(how|steps?|process|procedure|algorithm|method|kaise|steps kya|workflow|implement)\b", 0.80),
    "numerical": (r"\b(calculat|compute|formula|numerical|solve|value|how much|kitna|percentage|percent|\d+(?:\.\d+)?)\b", 0.88),
    "example": (r"\b(example|examples|illustrat|example de|udaharan|real world|scenario)\b", 0.88),
}


@dataclass(frozen=True)
class RetrievalPlan:
    question_type: str
    labels: list[str]
    confidence: float
    queries: list[str]
    required_facets: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def _split_parts(question: str) -> list[str]:
    parts = re.split(r"\s*(?:\?\s*|;\s*|\band also\b|\baur bhi\b|\bphir\b|\n+|\s+(?:and|aur)\s+(?=(?:what|how|explain|compare|calculate|kya|kaise)))\s*", question, flags=re.I)
    parts = [_clean(part.rstrip(" ?.")) for part in parts if _clean(part.rstrip(" ?."))]
    return parts if len(parts) > 1 else [question.strip()]


def _entities(question: str) -> list[str]:
    # Preserve useful multi-word names while avoiding generic Hinglish stop words.
    stop = {"what", "how", "why", "when", "where", "which", "who", "the", "and", "or", "is", "are", "kaise", "kya", "batao", "explain", "difference", "between", "compare", "please"}
    words = re.findall(r"[A-Za-z][A-Za-z0-9_-]*", question)
    entities = [word for word in words if word.lower() not in stop and len(word) > 2]
    return list(dict.fromkeys(entities))[:5]


def classify_question(question: str) -> tuple[list[str], float]:
    text = question.strip().lower()
    parts = _split_parts(question)
    labels: list[str] = []
    confidence = 0.55

    for label, (pattern, score) in _RULES.items():
        if re.search(pattern, text, flags=re.I):
            labels.append(label)
            confidence = max(confidence, score)

    if len(parts) > 1:
        labels.append("multi_part")
        confidence = max(confidence, 0.92)

    if not labels:
        labels = ["definition"]
        confidence = 0.55

    return list(dict.fromkeys(labels)), round(confidence, 2)


def plan_retrieval(question: str) -> RetrievalPlan:
    """Create bounded multi-query retrieval plan without external ML dependencies."""
    clean_question = _clean(question)
    labels, confidence = classify_question(clean_question)
    parts = _split_parts(clean_question)
    queries = [clean_question]

    entities = _entities(clean_question)
    entity_text = " ".join(entities)

    if "definition" in labels and len(clean_question.split()) <= 16:
        queries.append(f"{clean_question} definition meaning explained")
    if "comparison" in labels:
        names = re.split(r"\b(?:and|vs\.?|versus|aur|aur.*beech)\b", clean_question, flags=re.I)
        names = [_clean(name) for name in names if _clean(name)]
        queries.append(f"comparison {clean_question}")
        queries.extend(f"{name.strip()} details" for name in names[-2:] if name.strip())
    if "algorithm" in labels:
        queries.append(f"{entity_text} steps process algorithm")
    if "numerical" in labels:
        queries.append(f"{entity_text} formula calculation numerical value")
    if "example" in labels:
        queries.append(f"{entity_text} example illustration use case")
    if "multi_part" in labels:
        queries.extend(parts)

    # De-duplicate while preserving order and cap work to avoid latency regressions.
    queries = list(dict.fromkeys(_clean(q) for q in queries))[:5]

    facets: list[str] = []
    if "comparison" in labels:
        comparison_entities = entities[:2]
        if len(comparison_entities) >= 2:
            facets = [
                f"{comparison_entities[0]} evidence",
                f"{comparison_entities[1]} evidence",
                "comparison contrast evidence",
            ]
        else:
            facets = ["left item evidence", "right item evidence", "comparison contrast evidence"]
    elif "multi_part" in labels:
        facets = [f"subquestion_{index + 1}: {part}" for index, part in enumerate(parts[:5])]
    elif "definition" in labels:
        facets = [f"{entity_text or clean_question} definition and purpose"]
    elif "algorithm" in labels:
        facets = ["mechanism evidence", "ordered steps", "algorithm example or pseudocode"]
    elif "numerical" in labels:
        facets = ["formula", "given values", "calculation method and result"]
    elif "example" in labels:
        facets = ["concept evidence", "requested domain or language context", "concrete example"]

    return RetrievalPlan(
        question_type=labels[0],
        labels=labels,
        confidence=confidence,
        queries=queries,
        required_facets=facets,
    )


def check_required_facets(facets: Iterable[str], evidence: Iterable[dict]) -> dict:
    """Lightweight keyword baseline for required-facet coverage."""
    corpus = " ".join(str(chunk.get("content", chunk.get("text", ""))) for chunk in evidence).lower()
    covered: list[str] = []
    missing: list[str] = []
    for facet in facets:
        facet_text = facet.lower().replace("_", " ")
        keywords = [word for word in re.findall(r"[a-z0-9.-]{3,}", facet_text)
                    if word not in {"evidence", "and", "the", "item", "left", "right", "comparison", "subquestion"}]
        if not keywords:
            keywords = [facet_text]
        if any(keyword in corpus for keyword in keywords):
            covered.append(facet)
        else:
            missing.append(facet)
    return {"score": len(covered) / max(1, len(list(facets))), "covered": covered, "missing": missing}


def make_missing_facet_queries(question: str, missing_facets: Iterable[str]) -> list[str]:
    """Build at most two targeted searches for evidence that was not found."""
    queries = []
    for facet in missing_facets[:2]:
        facet_text = re.sub(r"^subquestion_\d+:\s*", "", facet)
        query = _clean(f"{question} {facet_text}")
        if query not in queries:
            queries.append(query)
    return queries[:2]


def reciprocal_rank_fusion(result_sets: Iterable[list[dict]], k: int = 60) -> list[dict]:
    """Merge ranked chunk lists with RRF, deduplicating by chunk identity."""
    fused: dict[str, float] = {}
    best: dict[str, dict] = {}

    for results in result_sets:
        for rank, chunk in enumerate(results, start=1):
            chunk_id = str(chunk.get("chunk_id", chunk.get("chunk_index", rank)))
            document_id = str(chunk.get("document_id", ""))
            key = f"{document_id}:{chunk_id}"
            fused[key] = fused.get(key, 0.0) + 1.0 / (k + rank)
            if key not in best:
                best[key] = dict(chunk)

    ranked_keys = sorted(fused, key=lambda key: (-fused[key], key))
    merged = []
    for key in ranked_keys:
        chunk = best[key]
        chunk["rrf_score"] = round(fused[key], 8)
        merged.append(chunk)
    return merged
