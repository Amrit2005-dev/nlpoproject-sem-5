import os
import uuid
from typing import Any

import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

# Configuration
API_URL = os.getenv("API_URL", "http://localhost:8000").rstrip("/")
DEFAULT_OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY", "")

# In-process direct fallback imports in case FastAPI backend is not started in a separate terminal
try:
    from app import db as local_db
    from app import llm as local_llm
    from app.main import (
        _process_and_store_document as local_process_document,
        get_embedding_model as local_get_embedding_model,
    )
    HAS_LOCAL_MODULES = True
except Exception:
    HAS_LOCAL_MODULES = False

# Page Configuration
st.set_page_config(
    page_title="PDF RAG Assistant & Direct Source Navigator",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom CSS for modern styling
st.markdown(
    """
    <style>
    .metric-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.82rem;
        font-weight: 600;
        margin-right: 6px;
    }
    .badge-success { background-color: #d1fae5; color: #065f46; }
    .badge-info { background-color: #e0f2fe; color: #0369a1; }
    .badge-warning { background-color: #fef3c7; color: #92400e; }
    .badge-purple { background-color: #f3e8ff; color: #6b21a8; }
    .answer-box {
        background-color: #f8fafc;
        border-left: 4px solid #3b82f6;
        padding: 18px;
        border-radius: 8px;
        margin-top: 15px;
        margin-bottom: 20px;
        color: #1e293b;
        font-size: 1.05rem;
        line-height: 1.6;
    }
    .citation-card {
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-left: 4px solid #10b981;
        border-radius: 8px;
        padding: 14px 18px;
        margin-bottom: 14px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .passage-box {
        background-color: #f8fafc;
        border-left: 3px solid #0284c7;
        padding: 10px 14px;
        border-radius: 4px;
        font-size: 0.92rem;
        color: #1e293b;
        margin-top: 8px;
    }
    .open-pdf-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background-color: #2563eb;
        color: #ffffff !important;
        text-decoration: none;
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 0.85rem;
        font-weight: 600;
        transition: background-color 0.2s;
    }
    .open-pdf-btn:hover {
        background-color: #1d4ed8;
        color: #ffffff !important;
    }
    .source-card {
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 10px;
    }
    .stButton>button {
        border-radius: 6px;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


def is_api_online() -> bool:
    try:
        res = requests.get(f"{API_URL}/health", timeout=2)
        return res.status_code == 200
    except Exception:
        return False


api_online = is_api_online()


# ==========================================
# SIDEBAR: Configuration & Workspace Quick-Index
# ==========================================
with st.sidebar:
    st.title("⚙️ RAG Settings")

    # System Status Indicator
    if api_online:
        st.success(f"🟢 **FastAPI Backend:** Connected ({API_URL})")
    else:
        st.info("🟡 **Direct Engine Mode:** FastAPI not detected. Using direct Python backend.")

    st.divider()

    # OpenRouter API Key Setting
    user_api_key = st.text_input(
        "OpenRouter API Key:",
        value=DEFAULT_OPENROUTER_KEY,
        type="password",
        help="Get a free key at https://openrouter.ai/keys",
    )

    # Model Selection
    model_options = [
        "nvidia/nemotron-3.5-lightning:free",
        "google/gemma-4-31b-it:free",
        "liquid/lfm-2.5-2.6b:free",
        "xingchen-agi/xing4.0-29b-a4b:free",
        "recursive/flint-v1.0:free",
        "thinkingmachines/inkling:free",
    ]
    selected_model = st.selectbox(
        "OpenRouter LLM Model (Free Tier):",
        model_options,
        index=0,
        help="All listed models are 100% free with an OpenRouter API key",
    )

    # Search & RAG Parameters
    st.subheader("Retrieval Hyperparameters")
    top_k = st.slider(
        "Chunks to Retrieve (top_k):",
        min_value=1,
        max_value=10,
        value=4,
        help="Number of most similar text chunks sent to LLM",
    )
    temperature = st.slider(
        "LLM Temperature:",
        min_value=0.0,
        max_value=0.7,
        value=0.1,
        step=0.05,
        help="Lower values produce strictly factual, deterministic answers",
    )

    st.divider()

    # Workspace Document Indexer Button
    st.subheader("⚡ Quick Index")
    st.caption("Scan workspace PDFs and index them with page-level attribution.")
    if st.button("🚀 Index Workspace Documents", type="secondary", use_container_width=True):
        with st.spinner("Extracting pages, generating BGE-M3 vectors, and storing..."):
            if api_online:
                try:
                    res = requests.post(f"{API_URL}/documents/index-workspace", timeout=120)
                    if res.ok:
                        data = res.json()
                        st.success(f"Indexed {data['indexed_count']} documents. Skipped {len(data['skipped'])} already indexed.")
                    else:
                        st.error(f"Error: {res.text}")
                except Exception as exc:
                    st.error(f"Failed to call API: {exc}")
            elif HAS_LOCAL_MODULES:
                from pathlib import Path
                workspace_path = Path(".")
                existing = {d["filename"] for d in local_db.list_documents()}
                indexed_count = 0
                for f in workspace_path.iterdir():
                    if f.is_file() and f.suffix.lower() in {".pdf", ".pptx", ".docx"}:
                        if f.name not in existing:
                            try:
                                local_process_document(f.name, f.read_bytes())
                                indexed_count += 1
                            except Exception as e:
                                st.error(f"Error on {f.name}: {e}")
                st.success(f"Indexed {indexed_count} new documents locally!")
            st.rerun()


# ==========================================
# DATA FETCHING HELPERS
# ==========================================
def get_documents_list() -> list[dict[str, Any]]:
    if api_online:
        try:
            res = requests.get(f"{API_URL}/documents", timeout=10)
            if res.ok:
                return res.json()
        except Exception:
            pass
    if HAS_LOCAL_MODULES:
        return local_db.list_documents()
    return []


documents = get_documents_list()

# ==========================================
# MAIN PAGE HEADER
# ==========================================
st.title("📚 Exact PDF Page Citations & Direct Source Navigator")
st.markdown(
    "Ask questions grounded in your lecture notes and PDF documents. "
    "Every answer is backed by **verifiable, page-level source citations** with direct links to open the original PDF at the exact page."
)

col_h1, col_h2, col_h3 = st.columns(3)
with col_h1:
    st.metric("Total Indexed Documents", len(documents))
with col_h2:
    total_chunks = sum(doc.get("chunk_count", 0) for doc in documents)
    st.metric("Total Vector Chunks", total_chunks)
with col_h3:
    st.metric("Active LLM Model", selected_model.split(":")[0].split("/")[-1])

st.divider()

# ==========================================
# TABS
# ==========================================
tab_ask, tab_upload, tab_search, tab_inspector = st.tabs(
    [
        "💬 Ask Your Documents (RAG)",
        "📤 Upload & Library",
        "🔍 Vector Similarity Search",
        "🔬 Vector Embedding Inspector",
    ]
)

# ------------------------------------------
# TAB 1: ASK YOUR DOCUMENTS (RAG)
# ------------------------------------------
with tab_ask:
    st.subheader("Ask Questions Grounded in Your Documents")

    if not documents:
        st.warning("No documents are currently indexed. Upload a PDF in the **Upload & Library** tab or click **Index Workspace Documents** in the sidebar!")
    else:
        # Document selector
        doc_options = {"All Documents": None}
        for d in documents:
            doc_options[f"{d['filename']} ({d['chunk_count']} chunks)"] = str(d["id"])

        selected_doc_label = st.selectbox(
            "Filter Context to Document:",
            list(doc_options.keys()),
            help="Choose a specific document or search across all indexed documents",
        )
        selected_doc_id = doc_options[selected_doc_label]

        # Suggested Questions
        st.caption("💡 Quick Example Questions:")
        example_cols = st.columns(3)
        sample_q = ""
        if example_cols[0].button("What subjects are in Semester III?"):
            sample_q = "What subjects are in Semester III?"
        if example_cols[1].button("What are the details for Data Structures using C++?"):
            sample_q = "What are the course code, credits, and details for Data Structures using C++?"
        if example_cols[2].button("What subjects are in Semester I?"):
            sample_q = "What subjects are taught in Semester I?"

        # Question input form
        with st.form("rag_query_form"):
            user_query = st.text_input(
                "Enter your question:",
                value=sample_q if sample_q else "",
                placeholder="e.g. What are the prerequisite courses for Artificial Intelligence?",
            )
            submit_ask = st.form_submit_button("🔍 Get Answer & Citations", type="primary")

        if submit_ask and user_query.strip():
            with st.spinner("Searching vectors, generating answer, and verifying source citations..."):
                answer_data = None
                # Call API or local fallback
                if api_online:
                    try:
                        payload = {
                            "query": user_query.strip(),
                            "document_id": selected_doc_id,
                            "top_k": top_k,
                            "model": selected_model,
                            "api_key": user_api_key,
                            "temperature": temperature,
                        }
                        res = requests.post(f"{API_URL}/rag/ask", json=payload, timeout=60)
                        if res.ok:
                            answer_data = res.json()
                        else:
                            st.error(f"API Error ({res.status_code}): {res.text}")
                    except Exception as exc:
                        st.error(f"Failed to reach API: {exc}")
                elif HAS_LOCAL_MODULES:
                    # In-process local execution
                    emb_model = local_get_embedding_model()
                    q_vec = emb_model.encode(
                        user_query.strip(),
                        normalize_embeddings=True,
                        convert_to_numpy=True,
                        show_progress_bar=False,
                    )
                    chunks = local_db.search_similar_chunks(
                        query_vector=q_vec,
                        top_k=top_k,
                        document_id=selected_doc_id,
                    )
                    try:
                        llm_res = local_llm.generate_rag_answer(
                            query=user_query.strip(),
                            retrieved_chunks=chunks,
                            model=selected_model,
                            api_key=user_api_key,
                            temperature=temperature,
                        )
                        answer_data = {
                            "query": user_query.strip(),
                            "answer": llm_res["answer"],
                            "model_used": llm_res["model_used"],
                            "chunks_used": llm_res["chunks_used"],
                            "sources": chunks,
                            "citations": llm_res.get("citations", []),
                            "total_tokens": llm_res.get("total_tokens", 0),
                        }
                    except Exception as e:
                        st.error(f"Generation error: {e}")

                # Display Results
                if answer_data:
                    st.markdown("### 🤖 Answer")
                    st.markdown(
                        f"""
                        <div class="answer-box">
                            {answer_data['answer']}
                        </div>
                        """,
                        unsafe_allow_html=True,
                    )

                    # Meta info
                    m_col1, m_col2, m_col3 = st.columns(3)
                    with m_col1:
                        st.caption(f"🧠 **Model Used:** `{answer_data['model_used']}`")
                    with m_col2:
                        st.caption(f"📑 **Retrieved Chunks:** {answer_data['chunks_used']}")
                    with m_col3:
                        st.caption(f"🪙 **Tokens:** {answer_data.get('total_tokens', 'N/A')}")

                    # ==========================================
                    # PHASE 8 & 9: VERIFIED SOURCE CITATIONS
                    # ==========================================
                    citations = answer_data.get("citations", [])
                    if citations:
                        st.markdown("### 📌 Verified Source Citations")
                        st.caption("Each citation is derived from the retrieved document chunk. Click **Open Source** to navigate directly to the page.")

                        for c_idx, cite in enumerate(citations, 1):
                            doc_name = cite.get("document_name", "Document")
                            page_num = cite.get("page_number", 1)
                            sec_title = cite.get("section_title")
                            passage = cite.get("quoted_text", "")
                            doc_id = cite.get("document_id", "")
                            pdf_url = f"{API_URL}/documents/{doc_id}/file#page={page_num}" if doc_id else ""

                            sec_badge = (
                                f'<span class="metric-badge badge-warning">🏷️ Section: {sec_title}</span>'
                                if sec_title
                                else ""
                            )
                            btn_html = (
                                f'<a href="{pdf_url}" target="_blank" class="open-pdf-btn">'
                                f'📄 Open Source (Page {page_num}) ↗</a>'
                                if pdf_url
                                else ""
                            )

                            st.markdown(
                                f"""
                                <div class="citation-card">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                                        <div>
                                            <span class="metric-badge badge-info">📄 {doc_name}</span>
                                            <span class="metric-badge badge-success">📖 Page {page_num}</span>
                                            {sec_badge}
                                        </div>
                                        <div>
                                            {btn_html}
                                        </div>
                                    </div>
                                    <div class="passage-box">
                                        <strong>Supporting Passage:</strong><br>
                                        <em>"{passage}"</em>
                                    </div>
                                </div>
                                """,
                                unsafe_allow_html=True,
                            )

                            # Optional interactive PDF.js/in-app embedded viewer preview
                            if pdf_url and api_online:
                                with st.expander(f"👁️ Embedded Preview: {doc_name} (Page {page_num})"):
                                    st.markdown(
                                        f'<iframe src="{pdf_url}&view=FitH" width="100%" height="550px" style="border: 1px solid #cbd5e1; border-radius: 8px;"></iframe>',
                                        unsafe_allow_html=True,
                                    )

                    # Supporting Chunk Evidence
                    sources = answer_data.get("sources", [])
                    if sources:
                        st.divider()
                        st.markdown("#### 🔬 All Retrieved Context Chunks")
                        for i, src in enumerate(sources, 1):
                            sim_pct = src.get("similarity", 0.0) * 100
                            p_num = src.get("page_number", 1)
                            sec = src.get("section_title")
                            sec_label = f" | Section: {sec}" if sec else ""
                            with st.expander(
                                f"Excerpt {i}: {src.get('filename')} (Page {p_num}{sec_label}) — Match: {sim_pct:.1f}%"
                            ):
                                st.write(src.get("content"))
                    else:
                        st.info("No matching chunks found above threshold.")


# ------------------------------------------
# TAB 2: UPLOAD & LIBRARY
# ------------------------------------------
with tab_upload:
    st.subheader("Upload Documents")
    with st.form("upload_document_form", clear_on_submit=True):
        uploaded_file = st.file_uploader(
            "Choose a document to chunk and embed with page-level attribution",
            type=["pdf", "pptx", "docx"],
            help="Maximum file size: 25 MB. Text and pages will be extracted, split into chunks, and embedded.",
        )
        submit_upload = st.form_submit_button("Upload and Embed Document", type="primary")

    if submit_upload:
        if uploaded_file is None:
            st.warning("Please choose a file to upload.")
        else:
            with st.spinner("Extracting pages, generating BGE-M3 embeddings, and storing vectors..."):
                if api_online:
                    try:
                        res = requests.post(
                            f"{API_URL}/documents",
                            files={
                                "file": (
                                    uploaded_file.name,
                                    uploaded_file.getvalue(),
                                    uploaded_file.type or "application/octet-stream",
                                )
                            },
                            timeout=600,
                        )
                        if res.ok:
                            data = res.json()
                            st.success(f"Successfully stored '{data['filename']}' ({data['chunk_count']} chunks, {data['source_units']} {data['unit_type']})!")
                            st.rerun()
                        else:
                            st.error(f"Upload failed: {res.text}")
                    except Exception as e:
                        st.error(f"Error communicating with API: {e}")
                elif HAS_LOCAL_MODULES:
                    try:
                        res = local_process_document(uploaded_file.name, uploaded_file.getvalue())
                        st.success(f"Successfully stored '{res.filename}' ({res.chunk_count} chunks)!")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Processing error: {e}")

    st.divider()
    st.subheader("Indexed Documents Library")
    if documents:
        table_rows = [
            {
                "Filename": d["filename"],
                "Format": d["source_type"].upper(),
                "Pages / Units": d["source_units"],
                "Vector Chunks": d["chunk_count"],
                "Indexed Date": d["created_at"][:19].replace("T", " ") if "T" in str(d["created_at"]) else str(d["created_at"]),
                "Document ID": str(d["id"]),
            }
            for d in documents
        ]
        st.dataframe(table_rows, use_container_width=True, hide_index=True)

        # Quick Links to View Files
        st.markdown("**Direct Document Viewer Links:**")
        cols = st.columns(min(len(documents), 3))
        for idx, doc in enumerate(documents):
            with cols[idx % 3]:
                doc_url = f"{API_URL}/documents/{doc['id']}/file#page=1"
                st.markdown(f"📄 [{doc['filename']} (Open PDF)]({doc_url})")

        st.divider()
        # Deletion
        del_col1, del_col2 = st.columns([3, 1])
        with del_col1:
            doc_to_delete = st.selectbox(
                "Select a document to remove:",
                documents,
                format_func=lambda x: f"{x['filename']} ({x['id']})",
                key="del_select",
            )
        with del_col2:
            st.write("")
            st.write("")
            if st.button("🗑️ Delete Document", type="secondary"):
                doc_id_to_del = doc_to_delete["id"]
                if api_online:
                    requests.delete(f"{API_URL}/documents/{doc_id_to_del}")
                elif HAS_LOCAL_MODULES:
                    local_db.delete_document(doc_id_to_del)
                st.success(f"Deleted document: {doc_to_delete['filename']}")
                st.rerun()
    else:
        st.info("No documents indexed yet.")


# ------------------------------------------
# TAB 3: VECTOR SIMILARITY SEARCH
# ------------------------------------------
with tab_search:
    st.subheader("Raw Semantic Vector Search & Page Ranking")
    st.write("Test semantic retrieval directly without calling the LLM to inspect cosine similarity rankings and page metadata.")

    with st.form("search_form"):
        search_query = st.text_input("Enter search keywords or phrase:", placeholder="e.g. CSET202 Data Structures C++")
        search_top_k = st.slider("Number of results", min_value=1, max_value=10, value=5, key="search_k")
        submit_search = st.form_submit_button("Search Vectors", type="primary")

    if submit_search and search_query.strip():
        with st.spinner("Computing query embedding and finding nearest neighbors..."):
            results = []
            if api_online:
                try:
                    res = requests.post(
                        f"{API_URL}/rag/search",
                        json={"query": search_query.strip(), "top_k": search_top_k},
                        timeout=30,
                    )
                    if res.ok:
                        results = res.json()
                except Exception as e:
                    st.error(f"Search API error: {e}")
            elif HAS_LOCAL_MODULES:
                emb_model = local_get_embedding_model()
                q_vec = emb_model.encode(
                    search_query.strip(),
                    normalize_embeddings=True,
                    convert_to_numpy=True,
                    show_progress_bar=False,
                )
                results = local_db.search_similar_chunks(query_vector=q_vec, top_k=search_top_k)

            if results:
                st.success(f"Found {len(results)} matching chunks.")
                for i, r in enumerate(results, 1):
                    score = r.get("similarity", 0.0)
                    p_num = r.get("page_number", 1)
                    sec = r.get("section_title")
                    sec_str = f" | Section: {sec}" if sec else ""
                    doc_id = r.get("document_id", "")
                    pdf_link = f"{API_URL}/documents/{doc_id}/file#page={p_num}" if doc_id else ""

                    with st.expander(
                        f"Rank #{i} | {r.get('filename')} (Page {p_num}{sec_str}) — Cosine Similarity: {score:.4f}"
                    ):
                        col_l, col_r = st.columns([3, 1])
                        with col_l:
                            st.markdown(f"**Document ID:** `{doc_id}` | **Chunk #{r.get('chunk_index')}`")
                        with col_r:
                            if pdf_link:
                                st.markdown(f"[📄 Open at Page {p_num} ↗]({pdf_link})")
                        st.markdown(f"**Content:**\n\n{r.get('content')}")
            else:
                st.warning("No matches found.")


# ------------------------------------------
# TAB 4: VECTOR EMBEDDING INSPECTOR
# ------------------------------------------
with tab_inspector:
    st.subheader("Inspect Stored Embeddings & Page Offsets")
    st.write("Inspect chunk text, page indices, character offsets, and the raw 1024-dimensional embedding vectors stored in the vector database.")

    if documents:
        insp_doc = st.selectbox(
            "Select document to inspect:",
            documents,
            format_func=lambda x: f"{x['filename']} ({x['chunk_count']} chunks)",
            key="insp_select",
        )
        insp_limit = st.slider("Number of chunks to display", min_value=1, max_value=10, value=3)

        chunks_data = []
        if api_online:
            try:
                res = requests.get(
                    f"{API_URL}/documents/{insp_doc['id']}/chunks",
                    params={"limit": insp_limit},
                    timeout=15,
                )
                if res.ok:
                    chunks_data = res.json()
            except Exception as e:
                st.error(f"Error fetching chunks: {e}")
        elif HAS_LOCAL_MODULES:
            chunks_data = local_db.get_document_chunks(insp_doc["id"], limit=insp_limit)

        for chunk in chunks_data:
            vec = chunk.get("embedding", [])
            p_num = chunk.get("page_number", 1)
            sec = chunk.get("section_title", "None detected")
            s_char = chunk.get("start_char", 0)
            e_char = chunk.get("end_char", 0)

            with st.expander(f"Chunk #{chunk['chunk_index']} | Page: {p_num} — Vector Length: {len(vec)} floats"):
                col_m1, col_m2 = st.columns(2)
                with col_m1:
                    st.markdown(f"**Page Number:** `{p_num}`")
                    st.markdown(f"**Section Heading:** `{sec}`")
                with col_m2:
                    st.markdown(f"**Character Offsets:** `{s_char}` to `{e_char}`")
                    doc_id = insp_doc.get("id")
                    if doc_id:
                        st.markdown(f"[📄 View in PDF (Page {p_num})]({API_URL}/documents/{doc_id}/file#page={p_num})")

                st.markdown("**Chunk Content:**")
                st.text(chunk["content"])
                st.markdown(f"**First 10 Embedding Dimensions (out of {len(vec)}):**")
                st.write(vec[:10])
                st.markdown("**Full Vector JSON:**")
                st.json(vec)
    else:
        st.info("No documents available to inspect.")
