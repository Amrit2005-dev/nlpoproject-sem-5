# PDF Document Vector Store & Grounded RAG Assistant

A complete Retrieval-Augmented Generation (RAG) system that extracts text from PDF, PPTX, and DOCX files, splits them into overlapping chunks, generates 1024-dimensional embeddings with `BAAI/bge-m3`, and answers user questions strictly grounded in the document content using OpenRouter LLMs.

---

## Features

- **Document Processing**: Extracts text and tables from PDF, PowerPoint (.pptx), and Word (.docx) documents.
- **Local Embedding Generation**: Generates normalized 1024-dimensional vector embeddings locally using `BAAI/bge-m3` via `sentence-transformers`.
- **Flexible Vector Storage (Dual-Mode)**:
  - **SQLite Fallback (Zero Setup)**: Automatically uses a local SQLite vector store with high-performance NumPy cosine similarity when running locally without Docker.
  - **PostgreSQL + pgvector**: Persists vectors in PostgreSQL with the `pgvector` extension when Docker Compose is running.
- **Strictly Grounded LLM Answers**: Queries the OpenRouter API with a strict system prompt instructing the model to answer **only** using facts from the retrieved chunks and to refuse speculation if the information is not in the document.
- **Source Citations**: Every answer includes the exact document excerpts, chunk indices, and similarity match percentages.
- **Code-Mixed Indian Language Support**: Detects English, Telugu, Hindi, romanized Telugu/Hindi, and mixed-script input. Answers follow the detected language and casual/formal register.
- **Interactive Web Interface**: Streamlit UI featuring:
  - 💬 **Ask Your Documents (RAG)**: Conversational Q&A with real-time strictly grounded answers and evidence expanders.
  - ⚡ **One-Click Workspace Indexer**: Automatically detects and indexes local PDF documents.
  - 📤 **Upload & Document Library**: Drag-and-drop document upload and management.
  - 🔍 **Vector Similarity Search**: Direct cosine similarity inspection of chunk rankings.
  - 🔬 **Vector Embedding Inspector**: View the raw 1024-dimensional embedding vectors.

---

## Quick Setup

### 1. Environment Configuration

Edit `.env` (or copy from `.env.example`):

```bash
# OpenRouter LLM Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=nvidia/nemotron-3.5-lightning:free
OPENROUTER_FALLBACK_MODELS=google/gemma-4-31b-it:free,liquid/lfm-2.5-2.6b:free,xingchen-agi/xing4.0-29b-a4b:free

# Database Configuration (PostgreSQL with pgvector, falls back to local SQLite if unreachable)
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/vectordb
SQLITE_DB_PATH=data/vectordb.sqlite

# Embedding Model Configuration
EMBEDDING_MODEL=BAAI/bge-m3

# API URL
API_URL=http://localhost:8000
```

### 2. Run Locally (Fastest & No Docker Required)

Activate your Python virtual environment and launch the FastAPI server and Streamlit frontend:

**Terminal 1 (FastAPI Backend):**
```powershell
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

**Terminal 2 (Streamlit UI):**
```powershell
.\.venv\Scripts\Activate.ps1
streamlit run frontend/app.py
```

- Web UI: http://localhost:8501
- Interactive API Docs (Swagger): http://localhost:8000/docs

*Note: If you run Streamlit by itself without running the FastAPI backend, it automatically activates the built-in direct engine mode and runs completely in-process!*

---

### 3. Run with Docker Compose

If you have Docker Desktop installed:

```powershell
docker compose up --build
```

- Web UI: http://localhost:8501
- API Docs: http://localhost:8000/docs
- PostgreSQL with pgvector: `localhost:5434`

---

## API Endpoints

- `GET /health` — Check server status, active database engine (PostgreSQL or SQLite), and OpenRouter key status.
- `POST /documents` — Upload a document (`multipart/form-data` with `file`) with page-aware extraction.
- `POST /documents/index-workspace` — Automatically index PDF documents located in the workspace root with page-level attribution.
- `GET /documents` — List all stored documents and their chunk counts.
- `GET /documents/{id}/chunks` — Inspect chunk text, 1-based page numbers, section titles, and raw 1024-dim embedding vectors.
- `GET /documents/{id}/file` — Serve original PDF file inline for direct browser navigation with `#page=N` fragment.
- `GET /documents/{id}/pages/{page_number}` — Page metadata endpoint (page number, chunk count, section titles, direct file URL).
- `DELETE /documents/{id}` — Delete a document, its stored vectors, and its file.
- `POST /rag/search` — Retrieve top matching chunks with page numbers and section headings using vector cosine similarity.
- `POST /rag/ask` — Semantic retrieval + strictly grounded answer generation with OpenRouter LLM + verified source citations.
- `GET /rag/models` — List available free OpenRouter LLM models.

### Example RAG Ask Request with Page Citations

```bash
curl -X POST "http://localhost:8000/rag/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the prerequisite courses and details for Data Structures using C++?",
    "top_k": 4
  }'
```

#### Example Response with Verified Citations:

```json
{
  "query": "What are the prerequisite courses and details for Data Structures using C++?",
  "answer": "Data Structures using C++ (Course Code: CSET202) covers arrays, stacks, queues, linked lists, trees, and graphs. [EXCERPT 1]",
  "model_used": "nvidia/nemotron-3.5-lightning:free",
  "chunks_used": 4,
  "citations": [
    {
      "citation_id": "cite-1",
      "chunk_id": 14,
      "document_id": "4b68e982-f5f6-4d04-a15f-8469c4f9ad28",
      "document_name": "BTech-Detailed-Syllabus_2022_compressed-1.pdf",
      "page_number": 15,
      "page_end": 15,
      "section_title": "CSET202 Data Structures using C++",
      "quoted_text": "CSET202 Data Structures using C++. Course Objectives: To understand basic concepts of data structures and algorithms.",
      "start_char": 0,
      "end_char": 210,
      "open_url": "/documents/4b68e982-f5f6-4d04-a15f-8469c4f9ad28/file#page=15"
    }
  ],
  "sources": [...]
}
```

---

## Running Tests

```powershell
$env:PYTHONPATH="."
.\.venv\Scripts\python.exe -m pytest
```
