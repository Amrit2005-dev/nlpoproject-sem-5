import pymupdf as fitz
import pytest

from app.extraction import extract_pdf_pages, extract_document_pages
from app.chunking import chunk_document_pages


def test_multipage_pdf_returns_correct_one_based_page_indexes() -> None:
    doc = fitz.open()
    # Create 3 pages with distinct text
    p1 = doc.new_page()
    p1.insert_text((72, 72), "Chapter 1: Foundations of Machine Learning and Supervised Learning")
    p2 = doc.new_page()
    p2.insert_text((72, 72), "Chapter 2: Unsupervised Learning, Clustering and K-Means")
    p3 = doc.new_page()
    p3.insert_text((72, 72), "Chapter 3: Deep Neural Networks and Backpropagation")

    content = doc.tobytes()
    pages, count, unit_type = extract_document_pages("lecture_notes.pdf", content)

    assert count == 3
    assert unit_type == "pages"
    assert len(pages) == 3

    # Check 1-based indexing
    assert pages[0].page_number == 1
    assert pages[1].page_number == 2
    assert pages[2].page_number == 3

    assert "Machine Learning" in pages[0].text
    assert "Unsupervised Learning" in pages[1].text
    assert "Deep Neural Networks" in pages[2].text


def test_empty_and_scanned_pages_are_flagged() -> None:
    doc = fitz.open()
    # Page 1 has text
    p1 = doc.new_page()
    p1.insert_text((72, 72), "Lecture Introduction: Overview of syllabus and objectives.")
    # Page 2 is completely empty
    doc.new_page()

    content = doc.tobytes()
    pages = extract_pdf_pages(content)

    assert len(pages) == 2
    assert pages[0].is_scanned_or_empty is False
    assert pages[1].is_scanned_or_empty is True
    assert pages[1].char_count == 0


def test_printed_page_labels_do_not_overwrite_physical_viewer_page_indexes() -> None:
    doc = fitz.open()
    # Create page
    page = doc.new_page()
    page.insert_text((72, 72), "Preface of the book")

    # Set custom printed label e.g. "iii"
    doc.set_page_labels([{"startpage": 0, "prefix": "pre-", "style": "r"}])
    content = doc.tobytes()

    pages = extract_pdf_pages(content)
    assert len(pages) == 1
    # Physical PDF viewer page index MUST remain 1
    assert pages[0].page_number == 1
    # Printed label is preserved separately
    assert pages[0].printed_label is not None


def test_chunk_metadata_preserves_page_numbers_and_character_offsets() -> None:
    doc = fitz.open()
    p1 = doc.new_page()
    p1.insert_text((72, 72), "Section 1.1: Supervised Learning relies on labeled ground-truth training pairs.")
    p2 = doc.new_page()
    p2.insert_text((72, 72), "Section 2.1: Reinforcement Learning uses trial and error feedback rewards.")

    content = doc.tobytes()
    pages = extract_pdf_pages(content)

    chunks = chunk_document_pages(
        pages=pages,
        document_id="test-doc-123",
        document_name="ml_lecture.pdf",
    )

    assert len(chunks) == 2
    assert chunks[0]["page_number"] == 1
    assert chunks[0]["page_end"] == 1
    assert chunks[0]["document_name"] == "ml_lecture.pdf"
    assert chunks[0]["start_char"] == 0
    assert chunks[0]["end_char"] > 0
    assert "Supervised Learning" in chunks[0]["content"]

    assert chunks[1]["page_number"] == 2
    assert chunks[1]["page_end"] == 2
    assert "Reinforcement Learning" in chunks[1]["content"]


def test_section_titles_are_optional_and_never_fabricated() -> None:
    doc = fitz.open()
    # Page with no headings, just ordinary sentences
    p1 = doc.new_page()
    p1.insert_text((72, 72), "the quick brown fox jumps over the lazy dog repeatedly without any heading structure.")

    content = doc.tobytes()
    pages = extract_pdf_pages(content)

    chunks = chunk_document_pages(pages, "doc-456", "plain.pdf")
    assert len(chunks) == 1
    # No heading should be fabricated
    assert chunks[0]["section_title"] is None
