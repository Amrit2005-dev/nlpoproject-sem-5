"""RAG Vector Embedding Service: Generates 1024-dimensional normalized dense vectors
using BAAI/bge-m3 via sentence-transformers.
"""

from functools import lru_cache
import logging
import numpy as np
from sentence_transformers import SentenceTransformer

from backend.config import EMBEDDING_MODEL_NAME, VECTOR_DIMENSIONS

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    """Load and cache the sentence-transformers embedding model."""
    logger.info("Loading embedding model: %s", EMBEDDING_MODEL_NAME)
    return SentenceTransformer(EMBEDDING_MODEL_NAME)


def generate_embeddings(texts: list[str]) -> np.ndarray:
    """Generate normalized float32 embedding vectors for a list of text strings."""
    if not texts:
        return np.empty((0, VECTOR_DIMENSIONS), dtype=np.float32)

    model = get_embedding_model()
    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return embeddings.astype(np.float32)


def generate_query_embedding(query: str) -> np.ndarray:
    """Generate a single normalized float32 vector for a user search or question."""
    model = get_embedding_model()
    vec = model.encode(
        query,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return vec.astype(np.float32)
