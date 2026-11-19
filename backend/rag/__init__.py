# RAG package
from backend.rag.extractor import (
    ExtractedPage,
    extract_document_pages,
    extract_pdf_pages,
    extract_pptx_slides,
    extract_docx_sections,
    extract_text,
)
from backend.rag.chunker import (
    ChunkMetadata,
    chunk_document_pages,
    split_into_chunks,
)
from backend.rag.embedder import (
    get_embedding_model,
    generate_embeddings,
    generate_query_embedding,
)
from backend.rag.generator import (
    SYSTEM_PROMPT,
    format_context_for_prompt,
    resolve_citations,
    call_openrouter,
    generate_chat_answer,
    generate_rag_answer,
    verify_api_key,
)
from backend.rag.question_segmentation import (
    check_required_facets,
    make_missing_facet_queries,
    plan_retrieval,
    reciprocal_rank_fusion,
)

__all__ = [
    "ExtractedPage",
    "extract_document_pages",
    "extract_pdf_pages",
    "extract_pptx_slides",
    "extract_docx_sections",
    "extract_text",
    "ChunkMetadata",
    "chunk_document_pages",
    "split_into_chunks",
    "get_embedding_model",
    "generate_embeddings",
    "generate_query_embedding",
    "SYSTEM_PROMPT",
    "format_context_for_prompt",
    "resolve_citations",
    "call_openrouter",
    "generate_chat_answer",
    "generate_rag_answer",
    "verify_api_key",
    "plan_retrieval",
    "check_required_facets",
    "make_missing_facet_queries",
    "reciprocal_rank_fusion",
]
