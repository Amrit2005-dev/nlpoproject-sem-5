"""
Typo correction and fuzzy query understanding for a RAG-based conversational AI.

Handles spelling mistakes, typing errors, Romanized Hindi (Hinglish) variations,
speech-to-text errors, and abbreviated queries commonly made by Indian college
students interacting with a document Q&A assistant.
"""

import logging
import re
import unicodedata
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 1. Common corrections dictionary
# ---------------------------------------------------------------------------

COMMON_CORRECTIONS: dict[str, str] = {
    # Academic / technical terms
    "architechture": "architecture",
    "algortihm": "algorithm",
    "algorythm": "algorithm",
    "nueral": "neural",
    "nural": "neural",
    "recuurent": "recurrent",
    "recurent": "recurrent",
    "convulutional": "convolutional",
    "convolusion": "convolutional",
    "backpropogation": "backpropagation",
    "backpropagtion": "backpropagation",
    "classificaiton": "classification",
    "segmentaion": "segmentation",
    "embeding": "embedding",
    "tokenizaton": "tokenization",
    "transformar": "transformer",
    "tranformer": "transformer",
    "attension": "attention",
    "attenion": "attention",
    "optimizaton": "optimization",
    "regularizaton": "regularization",
    "perceptorn": "perceptron",
    "perceptrn": "perceptron",
    "summrize": "summarize",
    "sumarize": "summarize",
    "explaination": "explanation",
    "differnce": "difference",
    "differance": "difference",
    "defination": "definition",
    "implmentation": "implementation",
    "implementaion": "implementation",
    # Viva / exam related
    "vivia": "viva",
    "vvia": "viva",
    "viv": "viva",
    "practial": "practical",
    "examinaton": "examination",
    "prepration": "preparation",
    "preparaton": "preparation",
    # Common greeting / chat typos
    "hy": "hi",
    "hii": "hi",
    "hiii": "hi",
    "helllo": "hello",
    "helo": "hello",
    "thnks": "thanks",
    "thnx": "thanks",
    "thanx": "thanks",
    "plz": "please",
    "pls": "please",
    "plss": "please",
    # Hinglish common words (normalize spellings)
    "samjao": "samjhao",
    "smjhao": "samjhao",
    "smjao": "samjhao",
    "btao": "batao",
    "btaao": "batao",
    "kese": "kaise",
    "kse": "kaise",
    "krdo": "kar do",
    "krro": "kar do",
    "kr do": "kar do",
}

# ---------------------------------------------------------------------------
# 2. Abbreviation expander
# ---------------------------------------------------------------------------

ABBREVIATION_MAP: dict[str, str] = {
    "rnn": "RNN (Recurrent Neural Network)",
    "lstm": "LSTM (Long Short-Term Memory)",
    "cnn": "CNN (Convolutional Neural Network)",
    "nlp": "NLP (Natural Language Processing)",
    "ml": "ML (Machine Learning)",
    "dl": "DL (Deep Learning)",
    "ai": "AI (Artificial Intelligence)",
    "gru": "GRU (Gated Recurrent Unit)",
    "gan": "GAN (Generative Adversarial Network)",
    "bert": "BERT",
    "gpt": "GPT",
    "svm": "SVM (Support Vector Machine)",
    "knn": "KNN (K-Nearest Neighbors)",
    "pca": "PCA (Principal Component Analysis)",
    "tf-idf": "TF-IDF",
    "tfidf": "TF-IDF",
    "bow": "BoW (Bag of Words)",
    "pos": "POS (Part of Speech)",
    "ner": "NER (Named Entity Recognition)",
}

# Set of uppercase abbreviation stems used by ``normalize_query`` to decide
# whether to preserve a token's casing.
_KNOWN_ABBREVIATIONS: set[str] = {
    v.split(" ")[0].upper() for v in ABBREVIATION_MAP.values()
}

# ---------------------------------------------------------------------------
# 5. Simple Levenshtein distance (standard DP – no external libs)
# ---------------------------------------------------------------------------


def _edit_distance(s1: str, s2: str) -> int:
    """Return the Levenshtein edit distance between *s1* and *s2*.

    Uses the standard dynamic-programming approach with O(min(m, n)) space.
    """
    if s1 == s2:
        return 0

    len1, len2 = len(s1), len(s2)

    # Optimisation: keep the shorter string as columns.
    if len1 > len2:
        s1, s2 = s2, s1
        len1, len2 = len2, len1

    # Previous and current row of distances.
    prev: list[int] = list(range(len1 + 1))
    curr: list[int] = [0] * (len1 + 1)

    for j in range(1, len2 + 1):
        curr[0] = j
        for i in range(1, len1 + 1):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            curr[i] = min(
                prev[i] + 1,      # deletion
                curr[i - 1] + 1,  # insertion
                prev[i - 1] + cost,  # substitution
            )
        prev, curr = curr, prev

    return prev[len1]


# ---------------------------------------------------------------------------
# 6. Vocabulary builder
# ---------------------------------------------------------------------------

_CURATED_TERMS: list[str] = [
    # NLP / ML / CS terms (~100)
    "accuracy", "activation", "algorithm", "architecture", "attention",
    "autoencoder", "backpropagation", "batch", "bias", "bigram",
    "binary", "classification", "classifier", "cluster", "clustering",
    "computation", "concatenation", "confusion", "convolution", "convolutional",
    "corpus", "cosine", "cross-entropy", "data", "dataset",
    "decision", "decoder", "deep", "definition", "dense",
    "difference", "dimensionality", "discriminator", "distribution", "document",
    "dropout", "embedding", "encoder", "ensemble", "epoch",
    "error", "evaluation", "examination", "explanation", "feature",
    "feedforward", "fine-tuning", "function", "gated", "generative",
    "gradient", "graph", "hidden", "hyperparameter", "implementation",
    "inference", "input", "kernel", "language", "latent",
    "layer", "learning", "lemmatization", "linear", "logistic",
    "loss", "matrix", "memory", "model", "morphology",
    "multiclass", "network", "neural", "neuron", "normalization",
    "objective", "optimization", "output", "overfitting", "padding",
    "parameter", "perceptron", "pipeline", "pooling", "practical",
    "precision", "prediction", "preparation", "preprocessing", "probability",
    "query", "recall", "recognition", "recurrent", "regression",
    "regularization", "reinforcement", "representation", "retrieval", "sampling",
    "segmentation", "semantic", "sentence", "sequence", "softmax",
    "stemming", "stochastic", "summarize", "supervised", "syntax",
    "tensor", "tokenization", "training", "transfer", "transformer",
    "trigram", "underfitting", "unsupervised", "validation", "vector",
    "viva", "vocabulary", "weight", "word",
]

# Common English words used in academic question contexts
_ACADEMIC_ENGLISH: list[str] = [
    "about", "also", "answer", "application", "approach",
    "between", "compare", "concept", "describe", "detail",
    "diagram", "discuss", "example", "explain", "give",
    "help", "hello", "how", "important", "list",
    "mark", "mean", "method", "note", "point",
    "process", "question", "short", "step", "tell",
    "thanks", "type", "unit", "using", "what",
    "when", "where", "which", "with", "write",
]


def build_vocabulary() -> set[str]:
    """Build a set of correctly-spelled terms for fuzzy matching.

    Sources:
    - Keys of :data:`ABBREVIATION_MAP`
    - Curated NLP / ML / CS terms
    - Common academic English words
    """
    vocab: set[str] = set()
    vocab.update(ABBREVIATION_MAP.keys())
    vocab.update(t.lower() for t in _CURATED_TERMS)
    vocab.update(w.lower() for w in _ACADEMIC_ENGLISH)
    # Also add correction *targets* so the vocabulary reflects correct forms.
    vocab.update(v.lower() for v in COMMON_CORRECTIONS.values())
    return vocab


# Module-level vocabulary (built once at import time).
_VOCABULARY: set[str] = build_vocabulary()
_FUZZY_VOCABULARY: set[str] = {
    term.lower()
    for term in [*_CURATED_TERMS, *COMMON_CORRECTIONS.values()]
    if term.isalpha() and len(term) >= 5
}

# ---------------------------------------------------------------------------
# 3. Main correction function
# ---------------------------------------------------------------------------

# Regex that splits on whitespace while keeping tokens intact.
_TOKEN_RE = re.compile(r"\S+")


def correct_typos(text: Optional[str]) -> dict:
    """Correct common typos, abbreviations, and misspellings in *text*.

    Parameters
    ----------
    text:
        Raw user query string.  ``None`` and empty strings are handled
        gracefully.

    Returns
    -------
    dict
        ``original``          – the input text as-is.
        ``corrected``         – the corrected text.
        ``corrections_made``  – list of ``{original, corrected}`` dicts.
        ``was_corrected``     – ``True`` if any correction was applied.
    """
    if not text:
        return {
            "original": text or "",
            "corrected": text or "",
            "corrections_made": [],
            "was_corrected": False,
        }

    tokens: list[str] = _TOKEN_RE.findall(text)
    corrected_tokens: list[str] = []
    corrections: list[dict[str, str]] = []

    for token in tokens:
        # Strip surrounding punctuation for lookup, re-attach afterwards.
        leading = ""
        trailing = ""
        core = token

        while core and not core[0].isalnum():
            leading += core[0]
            core = core[1:]
        while core and not core[-1].isalnum():
            trailing = core[-1] + trailing
            core = core[:-1]

        if not core:
            corrected_tokens.append(token)
            continue

        lower_core = core.lower()
        replacement: Optional[str] = None

        # --- Check multi-word correction keys (e.g. "kr do") ---
        # Handled implicitly because COMMON_CORRECTIONS maps single tokens
        # that may *produce* multi-word results (e.g. "krdo" → "kar do").

        # Step 1: direct dictionary lookup
        if lower_core in COMMON_CORRECTIONS:
            replacement = COMMON_CORRECTIONS[lower_core]

        # Step 2: abbreviation expansion
        elif lower_core in ABBREVIATION_MAP:
            replacement = ABBREVIATION_MAP[lower_core]

        # Step 3: fuzzy matching via edit distance for longer domain terms
        elif len(lower_core) >= 5:
            best_match: Optional[str] = None
            max_distance = 1 if len(lower_core) < 7 else 2
            best_dist = max_distance + 1

            for term in sorted(_FUZZY_VOCABULARY):
                # Quick length filter to skip obviously distant terms.
                if abs(len(term) - len(lower_core)) > max_distance:
                    continue
                dist = _edit_distance(lower_core, term)
                if dist < best_dist:
                    best_dist = dist
                    best_match = term
                    if dist == 0:
                        break  # exact match – no need to continue

            if best_match is not None and best_dist > 0:
                replacement = best_match

        if replacement is not None and replacement.lower() != lower_core:
            corrections.append({"original": core, "corrected": replacement})
            logger.debug("Typo corrected: '%s' → '%s'", core, replacement)
            corrected_tokens.append(f"{leading}{replacement}{trailing}")
        else:
            corrected_tokens.append(token)

    corrected_text = " ".join(corrected_tokens)

    if corrections:
        logger.info("Corrected %d typo(s) in query.", len(corrections))

    return {
        "original": text,
        "corrected": corrected_text,
        "corrections_made": corrections,
        "was_corrected": len(corrections) > 0,
    }


# ---------------------------------------------------------------------------
# 4. Light query normalizer
# ---------------------------------------------------------------------------

# Punctuation to strip (keep ?, . and internal hyphens)
_STRIP_PUNCT_RE = re.compile(r"[^\w\s?.-]+", re.UNICODE)
# Collapse multiple spaces / whitespace
_MULTI_SPACE_RE = re.compile(r"\s{2,}")

# Hinglish normalization map (applied during normalization only).
_HINGLISH_NORMALIZE: dict[str, str] = {
    "samjao": "samjhao",
    "smjhao": "samjhao",
    "smjao": "samjhao",
    "btao": "batao",
    "btaao": "batao",
    "kese": "kaise",
    "kse": "kaise",
    "krdo": "kar do",
    "krro": "kar do",
}


def normalize_query(text: Optional[str]) -> str:
    """Lightly normalize *text* without applying full typo correction.

    Steps performed:
    1. Unicode NFKC normalization.
    2. Collapse multiple spaces.
    3. Lowercase — but preserve known abbreviations in uppercase.
    4. Strip extraneous punctuation (keep ``?`` and ``.``).
    5. Normalize common Hinglish spelling variants.

    Parameters
    ----------
    text:
        Raw user query.  ``None`` and empty strings return ``""``.

    Returns
    -------
    str
        The normalized query string.
    """
    if not text:
        return ""

    # 1. Unicode NFKC normalization
    result: str = unicodedata.normalize("NFKC", text)

    # 4. Strip extraneous punctuation (before casing, so we work on originals)
    result = _STRIP_PUNCT_RE.sub("", result)

    # 2. Collapse whitespace
    result = _MULTI_SPACE_RE.sub(" ", result).strip()

    # 3. Lowercase while preserving known abbreviations
    out_tokens: list[str] = []
    for tok in result.split():
        upper_tok = tok.upper()
        if upper_tok in _KNOWN_ABBREVIATIONS:
            out_tokens.append(upper_tok)
        else:
            out_tokens.append(tok.lower())

    result = " ".join(out_tokens)

    # 5. Hinglish normalization (token-level)
    final_tokens: list[str] = []
    for tok in result.split():
        final_tokens.append(_HINGLISH_NORMALIZE.get(tok, tok))

    return " ".join(final_tokens)
