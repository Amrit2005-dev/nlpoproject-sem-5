from io import BytesIO

import pymupdf
import pytest
from docx import Document
from fastapi import HTTPException
from pptx import Presentation
from pptx.util import Inches

from app.main import extract_text


def test_extracts_pdf_text() -> None:
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_text((72, 72), "PDF content")

    text, units, unit_type = extract_text("sample.pdf", pdf.tobytes())

    assert "PDF content" in text
    assert units == 1
    assert unit_type == "pages"


def test_extracts_pptx_text_and_table_cells() -> None:
    presentation = Presentation()
    slide = presentation.slides.add_slide(presentation.slide_layouts[6])
    textbox = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(4), Inches(1))
    textbox.text = "Slide content"
    table = slide.shapes.add_table(1, 1, Inches(1), Inches(2), Inches(4), Inches(1))
    table.table.cell(0, 0).text = "Table content"
    content = BytesIO()
    presentation.save(content)

    text, units, unit_type = extract_text("sample.pptx", content.getvalue())

    assert "Slide content" in text
    assert "Table content" in text
    assert units == 1
    assert unit_type == "slides"


def test_extracts_docx_paragraphs_and_table_cells() -> None:
    document = Document()
    document.add_paragraph("Document content")
    table = document.add_table(rows=1, cols=1)
    table.cell(0, 0).text = "Table content"
    content = BytesIO()
    document.save(content)

    text, units, unit_type = extract_text("sample.docx", content.getvalue())

    assert "Document content" in text
    assert "Table content" in text
    assert units == 2
    assert unit_type == "paragraphs"


def test_invalid_pdf_returns_a_client_error() -> None:
    with pytest.raises(HTTPException) as error:
        extract_text("broken.pdf", b"not a PDF")

    assert error.value.status_code == 422
