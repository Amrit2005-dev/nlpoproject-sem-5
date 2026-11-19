"""Core services for Exam & Syllabus features:
- Study-Readiness Auditor (matches Image 2)
- Syllabus & Chapter extraction
- Prerequisites & Quick Check generator (matches Image 4)
- 1-by-1 Lesson Explainer
- PDF-Grounded Quiz Generator
"""

import json
import logging
import re
from typing import Any
import uuid

from backend import db
from backend.config import (
    GEMINI_API_KEY,
    DEFAULT_MODEL,
    UNIQUE_FALLBACK_MODELS,
)
from backend.rag.embedder import generate_query_embedding
from backend.rag.generator import call_gemini_api, format_context_for_prompt
from backend.study.schemas import (
    LessonExplainResponse,
    LessonPrerequisitesResponse,
    LessonQuizResponse,
    PrerequisiteItem,
    QuickCheckItem,
    QuizQuestion,
    SyllabusAuditResponse,
    TopicReportItem,
)

logger = logging.getLogger(__name__)


def _extract_topics_from_text(text: str) -> list[str]:
    """Extract candidate syllabus topics using headings, bullet points, and numbered lists."""
    lines = text.split("\n")
    candidates = []
    
    pattern = re.compile(r"^(?:(?:Unit|Chapter|Module|Topic|Lesson)\s*\d*[:.-]?\s*|\d+[\.\)]\s*)(.+)", re.IGNORECASE)
    
    for line in lines:
        cleaned = line.strip()
        if not cleaned or len(cleaned) < 4 or len(cleaned) > 100:
            continue
        m = pattern.match(cleaned)
        if m:
            topic = m.group(1).strip()
            if topic and topic.lower() not in [c.lower() for c in candidates]:
                candidates.append(topic)
        elif cleaned.startswith(("- ", "• ", "* ")) and len(cleaned) > 5:
            topic = cleaned[2:].strip()
            if topic and len(topic) < 80 and topic.lower() not in [c.lower() for c in candidates]:
                candidates.append(topic)

    # Fallback to general meaningful lines if regex found too few
    if len(candidates) < 3:
        for line in lines:
            cleaned = line.strip()
            if 10 < len(cleaned) < 60 and not cleaned.endswith((".", ":", ";")):
                if cleaned not in candidates:
                    candidates.append(cleaned)
            if len(candidates) >= 8:
                break

    return candidates[:15] or [
        "Core Concepts & Definitions",
        "Fundamental Architecture & Theory",
        "Types and Classifications",
        "Key Algorithms & Mathematical Formulations",
        "Advantages and Disadvantages",
        "Real-World Applications",
        "Numerical Examples & Case Studies"
    ]


def audit_study_readiness(
    syllabus_doc_id: str,
    notes_doc_ids: list[str]
) -> SyllabusAuditResponse:
    """Audit how well the uploaded study notes cover the syllabus topics (Image 2)."""
    syllabus_doc = db.get_document(syllabus_doc_id)
    if not syllabus_doc:
        raise ValueError(f"Syllabus document '{syllabus_doc_id}' not found.")

    syllabus_filename = syllabus_doc.get("filename", "Syllabus.pdf")
    syllabus_chunks = db.get_document_chunks(syllabus_doc_id, limit=50)
    full_syllabus_text = "\n".join([c.get("content", "") for c in syllabus_chunks])

    extracted_topics = _extract_topics_from_text(full_syllabus_text)

    # Gather notes filenames
    notes_filenames = []
    for nid in notes_doc_ids:
        ndoc = db.get_document(nid)
        if ndoc:
            notes_filenames.append(ndoc.get("filename", nid))

    topics_report: list[TopicReportItem] = []
    covered_count = 0
    partial_count = 0
    missing_count = 0

    for idx, topic_title in enumerate(extracted_topics, 1):
        max_sim = 0.0
        best_snippet = None

        if notes_doc_ids:
            try:
                # Query notes using topic vector
                q_vec = generate_query_embedding(topic_title)
                for nid in notes_doc_ids:
                    matches = db.search_similar_chunks(q_vec, top_k=2, document_id=nid)
                    for m in matches:
                        sim = float(m.get("similarity", 0.0))
                        if sim > max_sim:
                            max_sim = sim
                            content = m.get("content", "").strip()
                            best_snippet = content[:140] + "..." if len(content) > 140 else content
            except Exception as e:
                logger.warning("Error computing similarity for topic '%s': %s", topic_title, e)

        # Categorize status: Covered (>= 0.65), Partial (0.42 to 0.64), Missing (< 0.42)
        if max_sim >= 0.65:
            status = "Covered"
            covered_count += 1
        elif max_sim >= 0.42:
            status = "Partial"
            partial_count += 1
        else:
            status = "Missing"
            missing_count += 1

        topics_report.append(
            TopicReportItem(
                id=f"top-{idx}",
                topic_name=topic_title,
                status=status,
                max_similarity=round(max_sim, 3),
                notes_snippet=best_snippet,
                suggested_reading="Review lecture slides & textbook chapter." if status != "Covered" else None
            )
        )

    total = len(topics_report)
    if total > 0:
        overall_cov = int(round(((covered_count * 1.0 + partial_count * 0.5) / total) * 100))
    else:
        overall_cov = 0

    return SyllabusAuditResponse(
        overall_coverage=overall_cov,
        covered_count=covered_count,
        partial_count=partial_count,
        missing_count=missing_count,
        syllabus_filename=syllabus_filename,
        notes_filenames=notes_filenames,
        topics=topics_report
    )


def get_lesson_prerequisites(
    lesson_title: str,
    subject_id: str | None = None,
    document_ids: list[str] | None = None
) -> LessonPrerequisitesResponse:
    """Generate recommended prerequisites, concept pipeline, and quick check (Image 4)."""
    # Check if LLM is accessible to dynamically tailor prerequisites
    prompt = f"""You are an educational curriculum advisor.
Given the lesson/topic: "{lesson_title}", provide:
1. Three foundational prerequisites a student must know before learning this lesson.
2. An explanation of why these prerequisites are important for understanding "{lesson_title}".
3. A 3-step pipeline flow showing the learning progression ending with "{lesson_title}".
4. A friendly "Quick Check" question with the target concept.

Format your response strictly as valid JSON matching this structure:
{{
  "prerequisites": [
    {{"title": "Concept 1", "description": "Brief 1-sentence description.", "details": "Key formulas or ideas."}},
    {{"title": "Concept 2", "description": "Brief 1-sentence description.", "details": "Key formulas or ideas."}},
    {{"title": "Concept 3", "description": "Brief 1-sentence description.", "details": "Key formulas or ideas."}}
  ],
  "why_important": "2-3 sentences explaining why understanding these foundations is necessary.",
  "pipeline": ["Step 1", "Step 2", "{lesson_title}"],
  "quick_check": {{
    "question": "Do you understand Concept 1?",
    "concept": "Concept 1",
    "hint": "Brief reminder hint."
  }}
}}
Return ONLY JSON without markdown blocks.
"""
    if GEMINI_API_KEY.strip():
        for model in UNIQUE_FALLBACK_MODELS:
            try:
                res = call_gemini_api(
                    messages=[{"role": "user", "content": prompt}],
                    model=model,
                    api_key=GEMINI_API_KEY,
                    temperature=0.2
                )
                raw_text = res.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                cleaned = re.sub(r"```(?:json)?", "", raw_text).strip()
                data = json.loads(cleaned)
                
                prereqs = [
                    PrerequisiteItem(
                        id=f"pr-{i}",
                        title=p.get("title", f"Prerequisite {i}"),
                        description=p.get("description", ""),
                        details=p.get("details")
                    )
                    for i, p in enumerate(data.get("prerequisites", []), 1)
                ]
                return LessonPrerequisitesResponse(
                    lesson_title=lesson_title,
                    prerequisites=prereqs,
                    why_important=data.get("why_important", f"Foundational knowledge is required to grasp {lesson_title}."),
                    pipeline=data.get("pipeline", [prereqs[0].title if prereqs else "Basics", "Intermediate Steps", lesson_title]),
                    quick_check=QuickCheckItem(**data.get("quick_check", {
                        "question": f"Do you understand foundational concepts for {lesson_title}?",
                        "concept": prereqs[0].title if prereqs else "Fundamentals"
                    }))
                )
            except Exception as e:
                logger.warning("Prerequisite LLM model %s failed: %s", model, e)

    # High-quality contextual defaults (matching Image 4: Neural Networks / ML example)
    lt_lower = lesson_title.lower()
    if "neural" in lt_lower or "backpropagation" in lt_lower or "machine learning" in lt_lower or "deep" in lt_lower:
        prereqs = [
            PrerequisiteItem(
                id="pr-1",
                title="Derivatives",
                description="Understand the concept of derivatives and basic differentiation rules.",
                details="Rate of change, tangent slopes, and partial derivatives with respect to weights."
            ),
            PrerequisiteItem(
                id="pr-2",
                title="Chain Rule",
                description="Learn how the chain rule is used in differentiation of composite functions.",
                details="Essential for propagating errors backward through multiple hidden layers."
            ),
            PrerequisiteItem(
                id="pr-3",
                title="Basic Neural Networks",
                description="Get familiar with the structure of a simple forward neural network.",
                details="Inputs, weights, bias terms, and activation functions like ReLU or Sigmoid."
            )
        ]
        return LessonPrerequisitesResponse(
            lesson_title=lesson_title,
            prerequisites=prereqs,
            why_important="Backpropagation uses derivatives and the chain rule to update the weights of the network. Without these basics, it can be hard to understand how the model learns.",
            pipeline=["Derivatives", "Chain Rule", "Backpropagation"],
            quick_check=QuickCheckItem(
                question="Do you understand derivatives and the rate of change?",
                concept="Derivatives",
                hint="Derivatives measure how output changes when you nudge the input."
            )
        )

    # General academic fallback
    prereqs = [
        PrerequisiteItem(
            id="pr-1",
            title=f"Core Definitions of {lesson_title}",
            description="Fundamental terminology and foundational rules required for this topic.",
            details="Review the introductory definitions and scope."
        ),
        PrerequisiteItem(
            id="pr-2",
            title="Prerequisite Mathematical / Theoretical Framework",
            description="Basic principles, axioms, and underlying theory that govern this subject.",
            details="Key principles applied during problem solving."
        ),
        PrerequisiteItem(
            id="pr-3",
            title="Application Principles",
            description="How simpler components combine before stepping into advanced topics.",
            details="Understanding input-output mappings and mechanics."
        )
    ]
    return LessonPrerequisitesResponse(
        lesson_title=lesson_title,
        prerequisites=prereqs,
        why_important=f"Mastering foundational principles ensures you can follow each step of {lesson_title} without confusion.",
        pipeline=["Core Definitions", "Framework & Rules", lesson_title],
        quick_check=QuickCheckItem(
            question=f"Are you comfortable with the core definitions of {lesson_title}?",
            concept="Core Definitions",
            hint="Be sure you know the standard terms before jumping into complex details."
        )
    )


def explain_lesson(
    lesson_title: str,
    chapter_id: str | None = None,
    document_ids: list[str] | None = None,
    target_words: int = 1500
) -> LessonExplainResponse:
    """Generate a detailed, example-rich lesson guide grounded in uploaded documents."""
    if not document_ids:
        raise ValueError("Upload a PDF in the subject form so the lesson guide can use its content.")

    retrieved_chunks = []
    query_vector = generate_query_embedding(
        f"{lesson_title}: concepts, definitions, explanation, and examples"
    )
    for did in document_ids:
        retrieved_chunks.extend(
            db.search_similar_chunks(query_vector, top_k=6, document_id=did)
        )

    unique_chunks = {
        (str(chunk.get("document_id", "")), chunk.get("chunk_index")): chunk
        for chunk in retrieved_chunks
    }
    retrieved_chunks = list(unique_chunks.values())
    if not retrieved_chunks:
        raise ValueError("No readable PDF text was found for this subject. Re-upload the PDF and try again.")

    if not GEMINI_API_KEY.strip():
        raise RuntimeError("The lesson guide requires a Gemini API key. Configure GEMINI_API_KEY on the backend.")

    context_text = format_context_for_prompt(retrieved_chunks)

    prompt = f"""You are an expert NLP professor and curriculum specialist. Structure your explanation of "{lesson_title}" using this comprehensive, viva-ready format:

# {lesson_title}

### 1. Objective of the Assignment / Lesson
State the primary goal and what practical competencies the student develops.

### 2. Dataset & Preprocessing Pipeline
Describe dataset requirements, vocabulary size, sequence lengths, and preprocessing steps (tokenization, integer sequences, padding/truncation).

### 3. Model Architecture & Configuration
Provide a clear Markdown table of layers, purposes, and hyperparameters (embedding dimension, hidden units, optimizer, loss function, epochs).

### 4. Comparative Architecture Breakdown
Compare the relevant architectures (e.g., Simple RNN vs LSTM vs GRU, or baseline vs advanced models) highlighting gates, long-distance dependencies, and vanishing gradient trade-offs.

### 5. Model Evaluation & Performance Metrics
Outline evaluation metrics (Accuracy, Precision, Recall, F1-Score, Confusion Matrix) and prediction sampling.

### 6. Error Analysis & Limitations
Break down error categories (e.g., Negation, Long-distance dependencies, Sarcasm, Ambiguity, Truncation).

### 7. Important Viva Questions (Q&A Table)
Provide a 10-12 row Markdown table with high-yield Viva questions and crisp, accurate answers.

### 8. Final Conclusion & Viva Recommendations
Summarize key takeaways and specific topics to focus on for oral exams and assessments.

DOCUMENT CONTEXT:
{context_text}

GROUNDING RULES:
Cite supported PDF facts inline as [Page N]. Never invent facts or citations. Ensure mathematical and architectural precision.
"""
    for model in UNIQUE_FALLBACK_MODELS[:2]:
        try:
            res = call_gemini_api(
                messages=[{"role": "user", "content": prompt}],
                model=model,
                api_key=GEMINI_API_KEY,
                temperature=0.2,
                max_tokens=3000,
                timeout=30
            )
            text = res.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            if text:
                takeaways = [
                    f"Understand the core definitions and purpose of {lesson_title}.",
                    "Follow the worked example one step at a time.",
                    "Use the cited PDF pages to review the source."
                ]
                citations = [
                    {
                        "page_number": chunk.get("page_number", 1),
                        "filename": chunk.get("filename", "Document"),
                        "snippet": chunk.get("content", "")[:120]
                    }
                    for chunk in retrieved_chunks[:10]
                ]
                return LessonExplainResponse(
                    lesson_title=lesson_title,
                    content=text,
                    key_takeaways=takeaways,
                    citations=citations
                )
            logger.warning("Lesson explainer model %s returned an empty response.", model)
        except Exception as exc:
            logger.warning("Lesson explainer model %s failed: %s", model, exc)

    raise RuntimeError(
        "The AI service could not generate the detailed lesson guide. "
        "Check the backend logs or try again later."
    )


def generate_lesson_quiz(
    lesson_title: str,
    chapter_id: str | None = None,
    document_ids: list[str] | None = None,
    num_questions: int = 3
) -> LessonQuizResponse:
    """Generate short multiple choice questions grounded in the PDF for this lesson."""
    retrieved_chunks = []
    if document_ids:
        try:
            q_vec = generate_query_embedding(lesson_title)
            for did in document_ids:
                chunks = db.search_similar_chunks(q_vec, top_k=4, document_id=did)
                retrieved_chunks.extend(chunks)
        except Exception as e:
            logger.warning("Error searching chunks for quiz: %s", e)

    context_text = format_context_for_prompt(retrieved_chunks)

    prompt = f"""You are an exam creator. Generate {num_questions} multiple-choice quiz questions based on the lesson: "{lesson_title}".
Ground the questions strictly in the provided document excerpts.

DOCUMENT CONTEXT:
{context_text}

Return strictly a JSON array of objects with the following schema:
[
  {{
    "id": 1,
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_index": 0,
    "explanation": "Why Option A is correct according to the text."
  }}
]
Return ONLY JSON without markdown fences.
"""
    if GEMINI_API_KEY.strip():
        for model in UNIQUE_FALLBACK_MODELS:
            try:
                res = call_gemini_api(
                    messages=[{"role": "user", "content": prompt}],
                    model=model,
                    api_key=GEMINI_API_KEY,
                    temperature=0.2
                )
                raw_text = res.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                cleaned = re.sub(r"```(?:json)?", "", raw_text).strip()
                data = json.loads(cleaned)
                if isinstance(data, list) and len(data) > 0:
                    questions = [QuizQuestion(**q) for q in data]
                    return LessonQuizResponse(lesson_title=lesson_title, questions=questions)
            except Exception as e:
                logger.warning("Quiz generation model %s failed: %s", model, e)

    # Reliable fallback quiz for lesson
    fallback_questions = [
        QuizQuestion(
            id=1,
            question=f"What is the primary objective of studying {lesson_title}?",
            options=[
                f"To master foundational principles and mechanisms of {lesson_title}",
                "To memorize arbitrary definitions without understanding",
                "To skip prerequisite math foundations",
                "None of the above"
            ],
            correct_index=0,
            explanation=f"Understanding foundational principles of {lesson_title} is necessary for correct application."
        ),
        QuizQuestion(
            id=2,
            question=f"Which sequence best represents the preparatory progression for {lesson_title}?",
            options=[
                "Advanced implementation without review",
                "Prerequisites review -> Core concept breakdown -> Guided problem solving",
                "Guessing formulas at test time",
                "Skipping definitions"
            ],
            correct_index=1,
            explanation="A systematic progression starting with prerequisites guarantees solid retention."
        ),
        QuizQuestion(
            id=3,
            question=f"In typical exam assessments of {lesson_title}, what carries the highest importance?",
            options=[
                "Only writing the final answer without steps",
                "Clear definitions, stated assumptions, and step-by-step derivations",
                "Copying unrelated material",
                "Leaving the question unanswered"
            ],
            correct_index=1,
            explanation="Examiners award points for clarity of steps, explicit assumptions, and valid derivations."
        )
    ]
    return LessonQuizResponse(lesson_title=lesson_title, questions=fallback_questions)
