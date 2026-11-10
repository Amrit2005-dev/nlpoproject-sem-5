from app import llm


def test_resolve_citations_matches_explicit_excerpts() -> None:
    retrieved = [
        {
            "chunk_id": 101,
            "document_id": "doc-uuid-1",
            "filename": "Lecture1_ML.pdf",
            "chunk_index": 0,
            "page_number": 12,
            "page_end": 12,
            "section_title": "Supervised Learning",
            "content": "Supervised learning is a machine learning approach that uses labelled training data to train algorithms.",
        },
        {
            "chunk_id": 102,
            "document_id": "doc-uuid-1",
            "filename": "Lecture1_ML.pdf",
            "chunk_index": 1,
            "page_number": 15,
            "page_end": 15,
            "section_title": "Unsupervised Learning",
            "content": "Unsupervised learning finds hidden patterns and intrinsic groupings in unlabelled data.",
        },
    ]

    llm_answer = (
        "Supervised learning trains models on labelled datasets [EXCERPT 1], "
        "whereas unsupervised learning identifies intrinsic patterns without labels [EXCERPT 2]."
    )

    citations = llm.resolve_citations(llm_answer, retrieved)

    assert len(citations) == 2
    # First citation must map to chunk 0 / Page 12
    assert citations[0]["page_number"] == 12
    assert citations[0]["document_name"] == "Lecture1_ML.pdf"
    assert citations[0]["section_title"] == "Supervised Learning"
    assert "Supervised learning is a machine learning" in citations[0]["quoted_text"]
    assert citations[0]["open_url"] == "/documents/doc-uuid-1/file#page=12"

    # Second citation must map to chunk 1 / Page 15
    assert citations[1]["page_number"] == 15
    assert citations[1]["section_title"] == "Unsupervised Learning"
    assert citations[1]["open_url"] == "/documents/doc-uuid-1/file#page=15"


def test_resolve_citations_rejects_unknown_chunk_references() -> None:
    retrieved = [
        {
            "chunk_id": 10,
            "document_id": "doc-uuid-1",
            "filename": "Calculus.pdf",
            "chunk_index": 0,
            "page_number": 5,
            "content": "Derivatives measure the instantaneous rate of change of a function.",
        }
    ]

    # LLM hallucinates an excerpt number [EXCERPT 99] that does not exist in context
    llm_answer = "Derivatives measure rate of change [EXCERPT 99]."
    citations = llm.resolve_citations(llm_answer, retrieved)

    # Excerpt 99 must be rejected; no citation should map to an unknown chunk
    assert not any(c.get("page_number") == 99 for c in citations)
    # The valid retrieved chunk is used or citations reflect genuine data
    for c in citations:
        assert c["document_name"] == "Calculus.pdf"
        assert c["page_number"] == 5


def test_missing_metadata_does_not_cause_invented_pages() -> None:
    retrieved = [
        {
            "chunk_id": 20,
            "document_id": "doc-uuid-2",
            "filename": "Unknown.pdf",
            "chunk_index": 0,
            # Page number not set or None
            "page_number": None,
            "section_title": None,
            "content": "Some historical context without explicit page records.",
        }
    ]

    llm_answer = "Here is the historical context [EXCERPT 1]."
    citations = llm.resolve_citations(llm_answer, retrieved)

    assert len(citations) == 1
    # Fallback must be deterministic 1, never a random or fabricated number
    assert citations[0]["page_number"] == 1
    assert citations[0]["section_title"] is None
