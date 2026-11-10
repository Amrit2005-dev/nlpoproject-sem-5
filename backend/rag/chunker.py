"""RAG Text Chunker: Metadata-aware chunking preserving 1-based page numbers,
character offsets, and section titles.
"""

from dataclasses import asdict, dataclass
from typing import Any

CHUNK_SIZE = 1600
CHUNK_OVERLAP = 200


@dataclass
class ChunkMetadata:
    chunk_id: int
    chunk_index: int
    document_id: str
    document_name: str
    page_number: int
    page_end: int
    section_title: str | None
    content: str
    start_char: int
    end_char: int
    storage_key: str

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["chunk_text"] = self.content
        return d


def split_into_chunks(text: str) -> list[str]:
    """Legacy helper splitting a continuous string into overlapping character chunks."""
    text = " ".join(text.split())
    chunks: list[str] = []
    start = 0

    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        if end < len(text):
            split_at = text.rfind(" ", start + CHUNK_SIZE // 2, end)
            if split_at > start:
                end = split_at

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(text):
            break

        start = max(end - CHUNK_OVERLAP, start + 1)
        while start < len(text) and text[start].isspace():
            start += 1

    return chunks


def chunk_document_pages(
    pages: list[Any],
    document_id: str = "",
    document_name: str = "",
    storage_key: str = "",
) -> list[dict[str, Any]]:
    """
    Split pages into chunks while preserving 1-based page numbers,
    character offsets, and section titles.
    Prefers page-contained chunks to guarantee exact page attribution.
    """
    chunks: list[dict[str, Any]] = []
    chunk_index = 0

    for page in pages:
        # Support either ExtractedPage object or dict
        if hasattr(page, "text"):
            page_text = page.text.strip()
            page_num = getattr(page, "page_number", 1)
            headings = getattr(page, "section_headings", [])
        else:
            page_text = page.get("text", "").strip()
            page_num = page.get("page_number", 1)
            headings = page.get("section_headings", [])

        if not page_text:
            continue

        # If page fits in one chunk
        if len(page_text) <= CHUNK_SIZE:
            section = headings[0] if headings else None
            meta = ChunkMetadata(
                chunk_id=chunk_index,
                chunk_index=chunk_index,
                document_id=str(document_id),
                document_name=document_name,
                page_number=page_num,
                page_end=page_num,
                section_title=section,
                content=page_text,
                start_char=0,
                end_char=len(page_text),
                storage_key=storage_key,
            )
            chunks.append(meta.to_dict())
            chunk_index += 1
            continue

        # Split larger page into overlapping segments
        start = 0
        while start < len(page_text):
            end = min(start + CHUNK_SIZE, len(page_text))
            if end < len(page_text):
                split_at = page_text.rfind(" ", start + CHUNK_SIZE // 2, end)
                if split_at > start:
                    end = split_at

            chunk_content = page_text[start:end].strip()
            if chunk_content:
                # Find most relevant section heading for this segment
                active_heading: str | None = None
                if headings:
                    active_heading = headings[0]
                    for h in headings:
                        pos = page_text.find(h)
                        if 0 <= pos <= start:
                            active_heading = h

                meta = ChunkMetadata(
                    chunk_id=chunk_index,
                    chunk_index=chunk_index,
                    document_id=str(document_id),
                    document_name=document_name,
                    page_number=page_num,
                    page_end=page_num,
                    section_title=active_heading,
                    content=chunk_content,
                    start_char=start,
                    end_char=end,
                    storage_key=storage_key,
                )
                chunks.append(meta.to_dict())
                chunk_index += 1

            if end >= len(page_text):
                break

            start = max(end - CHUNK_OVERLAP, start + 1)
            while start < len(page_text) and page_text[start].isspace():
                start += 1

    return chunks
