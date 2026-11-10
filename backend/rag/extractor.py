"""RAG Document Extractor: Page-aware text extraction for PDF, PPTX, and DOCX documents.
Preserves 1-based viewer page numbers, section titles, and flags scanned/empty pages.
"""

from dataclasses import dataclass, field
import io
import os
import re
from typing import Any
from zipfile import BadZipFile

from docx import Document as WordDocument
from docx.opc.exceptions import PackageNotFoundError as DocxPackageNotFoundError
from fastapi import HTTPException
import pymupdf as fitz
from pptx import Presentation
from pptx.exc import PackageNotFoundError as PptxPackageNotFoundError


@dataclass
class ExtractedPage:
    page_number: int  # 1-based index matching PDF viewer (1, 2, 3...)
    printed_label: str | None  # Printed page label if different from physical page
    text: str  # Cleaned text content of the page
    raw_text: str  # Uncleaned text with original spacing
    char_count: int  # Character count
    is_scanned_or_empty: bool  # True if page has no or insufficient text
    section_headings: list[str] = field(default_factory=list)


def _detect_pdf_headings(page: fitz.Page) -> list[str]:
    """Detect section headings from PDF page blocks using layout and casing heuristics."""
    headings: list[str] = []
    try:
        blocks = page.get_text("blocks")
        for b in blocks:
            # Block structure: (x0, y0, x1, y1, text, block_no, block_type)
            if len(b) >= 7 and b[6] == 0:  # 0 indicates text block
                b_text = b[4].strip()
                lines = [line.strip() for line in b_text.splitlines() if line.strip()]
                for line in lines:
                    # Filter short plausible heading candidates
                    if 3 <= len(line) <= 90:
                        is_numbered_sec = bool(
                            re.match(r"^(\d+(\.\d+)*|[A-Z](\.\d+)*)\s+[A-Za-z]", line)
                        )
                        is_keyword_sec = bool(
                            re.match(
                                r"^(chapter|section|unit|module|part|appendix|lecture|syllabus|course)\b",
                                line,
                                re.IGNORECASE,
                            )
                        )
                        is_all_caps_title = line.isupper() and len(line) >= 5 and " " in line

                        if is_numbered_sec or is_keyword_sec or is_all_caps_title:
                            if line not in headings:
                                headings.append(line)
    except Exception:
        pass
    return headings


def extract_pdf_pages(content: bytes) -> list[ExtractedPage]:
    """Extract pages from a PDF stream, preserving 1-based page indices and headings."""
    pages: list[ExtractedPage] = []
    try:
        with fitz.open(stream=content, filetype="pdf") as doc:
            if doc.needs_pass:
                raise HTTPException(
                    status_code=422, detail="Password-protected PDFs are not supported."
                )

            total_pages = doc.page_count
            if total_pages == 0:
                raise HTTPException(status_code=422, detail="The PDF file has 0 pages.")

            # Extract printed page labels if present in the document catalog
            page_labels = []
            try:
                page_labels = doc.get_page_labels()
            except Exception:
                page_labels = []

            for page_idx in range(total_pages):
                page = doc[page_idx]
                viewer_page = page_idx + 1  # 1-based page index!

                printed_label = None
                if page_labels and page_idx < len(page_labels):
                    val = str(page_labels[page_idx]).strip()
                    if val and val != str(viewer_page):
                        printed_label = val

                raw_text = page.get_text("text") or ""
                clean_text = " ".join(raw_text.split())
                char_count = len(clean_text)

                # Check if page is scanned or empty
                has_images = len(page.get_images()) > 0
                is_scanned_or_empty = (char_count < 25) and (has_images or char_count == 0)

                headings = _detect_pdf_headings(page)

                pages.append(
                    ExtractedPage(
                        page_number=viewer_page,
                        printed_label=printed_label,
                        text=clean_text,
                        raw_text=raw_text,
                        char_count=char_count,
                        is_scanned_or_empty=is_scanned_or_empty,
                        section_headings=headings,
                    )
                )
    except fitz.FileDataError as exc:
        raise HTTPException(status_code=422, detail="The PDF file is invalid.") from exc

    return pages


def extract_pptx_slides(content: bytes) -> list[ExtractedPage]:
    """Extract slides from a PowerPoint presentation as 1-based units."""
    try:
        presentation = Presentation(io.BytesIO(content))
    except (BadZipFile, KeyError, PptxPackageNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="The PPTX file is invalid.") from exc

    pages: list[ExtractedPage] = []

    def shape_text(shape: Any) -> list[str]:
        text_parts: list[str] = []
        if getattr(shape, "has_text_frame", False):
            text_parts.append(shape.text)
        if getattr(shape, "has_table", False):
            text_parts.extend(
                cell.text
                for row in shape.table.rows
                for cell in row.cells
            )
        if getattr(shape, "shape_type", None) == 6:  # Group shape
            text_parts.extend(
                part
                for child in shape.shapes
                for part in shape_text(child)
            )
        return text_parts

    for idx, slide in enumerate(presentation.slides):
        slide_num = idx + 1
        slide_title = None
        if slide.shapes.title and slide.shapes.title.text.strip():
            slide_title = slide.shapes.title.text.strip()

        parts = [part for shape in slide.shapes for part in shape_text(shape)]
        raw_text = "\n".join(parts)
        clean_text = " ".join(raw_text.split())
        char_count = len(clean_text)

        headings = [slide_title] if slide_title else []

        pages.append(
            ExtractedPage(
                page_number=slide_num,
                printed_label=None,
                text=clean_text,
                raw_text=raw_text,
                char_count=char_count,
                is_scanned_or_empty=(char_count == 0),
                section_headings=headings,
            )
        )

    return pages


def extract_docx_sections(content: bytes) -> list[ExtractedPage]:
    """Extract sections/pages from a Word document as 1-based units."""
    try:
        document = WordDocument(io.BytesIO(content))
    except (BadZipFile, KeyError, DocxPackageNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="The DOCX file is invalid.") from exc

    pages: list[ExtractedPage] = []
    current_unit = 1
    current_texts: list[str] = []
    current_heading: str | None = None

    for p in document.paragraphs:
        p_text = p.text.strip()
        if not p_text:
            continue

        style_name = getattr(p.style, "name", "").lower()
        if "heading" in style_name or "title" in style_name:
            if current_texts:
                clean = " ".join(" ".join(current_texts).split())
                pages.append(
                    ExtractedPage(
                        page_number=current_unit,
                        printed_label=None,
                        text=clean,
                        raw_text="\n".join(current_texts),
                        char_count=len(clean),
                        is_scanned_or_empty=(len(clean) == 0),
                        section_headings=[current_heading] if current_heading else [],
                    )
                )
                current_unit += 1
                current_texts = []
            current_heading = p_text

        current_texts.append(p_text)

    # Tables
    for table in document.tables:
        for row in table.rows:
            cell_texts = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cell_texts:
                current_texts.append(" | ".join(cell_texts))

    if current_texts:
        clean = " ".join(" ".join(current_texts).split())
        pages.append(
            ExtractedPage(
                page_number=current_unit,
                printed_label=None,
                text=clean,
                raw_text="\n".join(current_texts),
                char_count=len(clean),
                is_scanned_or_empty=(len(clean) == 0),
                section_headings=[current_heading] if current_heading else [],
            )
        )

    return pages


def extract_document_pages(
    filename: str, content: bytes
) -> tuple[list[ExtractedPage], int, str]:
    """
    Main page-aware extractor for PDF, PPTX, and DOCX documents.
    Returns:
        (pages, unit_count, unit_type)
    """
    extension = os.path.splitext(filename)[1].lower()
    if extension == ".pdf":
        pages = extract_pdf_pages(content)
        return pages, len(pages), "pages"
    if extension == ".pptx":
        pages = extract_pptx_slides(content)
        return pages, len(pages), "slides"
    if extension == ".docx":
        pages = extract_docx_sections(content)
        return pages, len(pages), "sections"

    raise HTTPException(
        status_code=415, detail="Supported file types are PDF, PPTX, and DOCX."
    )


def extract_text(filename: str, content: bytes) -> tuple[str, int, str]:
    """Legacy extraction helper maintained for backward compatibility with existing tests."""
    extension = os.path.splitext(filename)[1].lower()
    if extension == ".pdf":
        try:
            with fitz.open(stream=content, filetype="pdf") as document:
                if document.needs_pass:
                    raise HTTPException(
                        status_code=422, detail="Password-protected PDFs are not supported."
                    )
                text = "\n".join(page.get_text() for page in document)
                return text, document.page_count, "pages"
        except fitz.FileDataError as exc:
            raise HTTPException(status_code=422, detail="The PDF file is invalid.") from exc

    if extension == ".pptx":
        try:
            presentation = Presentation(io.BytesIO(content))
        except (BadZipFile, KeyError, PptxPackageNotFoundError, ValueError) as exc:
            raise HTTPException(status_code=422, detail="The PPTX file is invalid.") from exc

        def shape_text(shape: object) -> list[str]:
            text_parts: list[str] = []
            if getattr(shape, "has_text_frame", False):
                text_parts.append(shape.text)
            if getattr(shape, "has_table", False):
                text_parts.extend(
                    cell.text
                    for row in shape.table.rows
                    for cell in row.cells
                )
            if getattr(shape, "shape_type", None) == 6:
                text_parts.extend(
                    part
                    for child in shape.shapes
                    for part in shape_text(child)
                )
            return text_parts

        slides = [
            "\n".join(part for shape in slide.shapes for part in shape_text(shape))
            for slide in presentation.slides
        ]
        return "\n".join(slides), len(slides), "slides"

    if extension == ".docx":
        try:
            document = WordDocument(io.BytesIO(content))
        except (BadZipFile, KeyError, DocxPackageNotFoundError, ValueError) as exc:
            raise HTTPException(status_code=422, detail="The DOCX file is invalid.") from exc
        text_parts = [paragraph.text for paragraph in document.paragraphs]
        text_parts.extend(
            cell.text for table in document.tables for row in table.rows for cell in row.cells
        )
        return "\n".join(text_parts), len(text_parts), "paragraphs"

    raise HTTPException(
        status_code=415, detail="Supported file types are PDF, PPTX, and DOCX."
    )
