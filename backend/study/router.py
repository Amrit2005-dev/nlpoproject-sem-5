"""FastAPI router for Study & Exam features:
- /api/study/audit
- /api/study/subjects
- /api/study/prerequisites
- /api/study/explain
- /api/study/quiz
"""

import logging
from fastapi import APIRouter, HTTPException

from backend.study import db as study_db
from backend.study import service as study_service
from backend.study.schemas import (
    ChapterUpdateRequest,
    LessonExplainRequest,
    LessonExplainResponse,
    LessonPrerequisitesRequest,
    LessonPrerequisitesResponse,
    LessonQuizRequest,
    LessonQuizResponse,
    PlannerOverviewResponse,
    QuizVerifyRequest,
    QuizVerifyResponse,
    SubjectCreateRequest,
    SubjectDocumentUpdateRequest,
    SubjectItem,
    SyllabusAuditRequest,
    SyllabusAuditResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------
# Feature: Study-Readiness Auditor (Image 2)
# ---------------------------------------------------------
@router.post("/audit", response_model=SyllabusAuditResponse)
async def run_syllabus_audit(req: SyllabusAuditRequest):
    """Run coverage audit comparing Syllabus PDF against Study Notes PDFs."""
    try:
        result = study_service.audit_study_readiness(
            syllabus_doc_id=req.syllabus_doc_id,
            notes_doc_ids=req.notes_doc_ids
        )
        study_db.save_audit_result(result.dict())
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as exc:
        logger.exception("Error during study-readiness audit: %s", exc)
        raise HTTPException(status_code=500, detail=f"Audit failed: {exc}")


@router.get("/audit/latest")
async def get_latest_audit():
    """Retrieve the latest audit report if any."""
    latest = study_db.get_latest_audit()
    return latest or {}


# ---------------------------------------------------------
# Feature: Exam & Syllabus Planner (Image 3)
# ---------------------------------------------------------
@router.get("/planner/overview", response_model=PlannerOverviewResponse)
async def get_planner_overview():
    """Get overall progress stats and all subjects."""
    subjects = study_db.get_all_subjects()
    total_chapters = sum(s.get("total_chapters", 0) for s in subjects)
    completed_chapters = sum(s.get("completed_chapters", 0) for s in subjects)
    in_progress_chapters = sum(s.get("in_progress_chapters", 0) for s in subjects)
    overall_progress = int(round((completed_chapters / total_chapters) * 100)) if total_chapters > 0 else 0

    return PlannerOverviewResponse(
        overall_progress=overall_progress,
        total_chapters=total_chapters,
        completed_chapters=completed_chapters,
        in_progress_chapters=in_progress_chapters,
        subjects=[SubjectItem(**s) for s in subjects]
    )


@router.get("/subjects", response_model=list[SubjectItem])
async def list_subjects():
    """List all subjects with calculated progress."""
    subjects = study_db.get_all_subjects()
    return [SubjectItem(**s) for s in subjects]


@router.post("/subjects", response_model=SubjectItem)
async def create_subject(req: SubjectCreateRequest):
    """Create a new subject and optionally extract chapters from an uploaded document."""
    chapters = req.manual_chapters or []
    doc_ids = [req.document_id] if req.document_id else []

    if req.document_id and req.auto_extract_from_doc and not chapters:
        try:
            # Auto-extract from document text
            doc_chunks = study_service.db.get_document_chunks(req.document_id, limit=30)
            full_text = "\n".join([c.get("content", "") for c in doc_chunks])
            extracted = study_service._extract_topics_from_text(full_text)
            if extracted:
                chapters = extracted
        except Exception as e:
            logger.warning("Could not auto-extract chapters: %s", e)

    if not chapters:
        chapters = [
            f"Introduction to {req.name}",
            "Core Theoretical Foundations",
            "Advanced Methodology",
            "Practical Applications & Review"
        ]

    created = study_db.add_subject(
        name=req.name,
        chapters=chapters,
        color=req.color,
        doc_ids=doc_ids
    )
    return SubjectItem(**created)


@router.get("/subjects/{subject_id}", response_model=SubjectItem)
async def get_subject(subject_id: str):
    """Retrieve details for a specific subject."""
    subj = study_db.get_subject_by_id(subject_id)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    return SubjectItem(**subj)


@router.put("/subjects/{subject_id}/documents", response_model=SubjectItem)
async def update_subject_documents(subject_id: str, req: SubjectDocumentUpdateRequest):
    """Attach uploaded documents to an existing subject."""
    for document_id in req.document_ids:
        if not study_service.db.get_document(document_id):
            raise HTTPException(status_code=404, detail=f"Document not found: {document_id}")

    subject = study_db.set_subject_document_ids(subject_id, req.document_ids)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    updated_subject = study_db.get_subject_by_id(subject_id)
    if not updated_subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return SubjectItem(**updated_subject)


@router.put("/subjects/{subject_id}/chapters/{chapter_id}")
async def update_chapter_status(
    subject_id: str,
    chapter_id: str,
    req: ChapterUpdateRequest
):
    """Update chapter status ('not_started', 'in_progress', 'completed') and notes."""
    updated = study_db.update_chapter(
        subject_id=subject_id,
        chapter_id=chapter_id,
        status=req.status,
        notes=req.notes,
        title=req.title
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Chapter or subject not found")
    return updated


@router.delete("/subjects")
async def clear_all_subjects_endpoint():
    """Clear all subjects from the study planner."""
    study_db.clear_all_subjects()
    return {"ok": True, "cleared": True}


@router.delete("/subjects/{subject_id}")
async def delete_subject_endpoint(subject_id: str):
    """Delete a subject from the study planner."""
    success = study_db.delete_subject(subject_id)
    if not success:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"ok": True, "deleted_id": subject_id}


# ---------------------------------------------------------
# Feature: Prerequisites & Quick Check (Image 4)
# ---------------------------------------------------------
@router.post("/prerequisites", response_model=LessonPrerequisitesResponse)
async def get_lesson_prerequisites_endpoint(req: LessonPrerequisitesRequest):
    """Get prerequisites, importance explanation, concept pipeline, and quick check."""
    return study_service.get_lesson_prerequisites(
        lesson_title=req.lesson_title,
        subject_id=req.subject_id,
        document_ids=req.document_ids
    )


# ---------------------------------------------------------
# Feature: 1-by-1 Lesson Explainer
# ---------------------------------------------------------
@router.post("/explain", response_model=LessonExplainResponse)
async def explain_lesson_endpoint(req: LessonExplainRequest):
    """Explain a specific lesson step-by-step using document context."""
    try:
        return study_service.explain_lesson(
            lesson_title=req.lesson_title,
            chapter_id=req.chapter_id,
            document_ids=req.document_ids,
            target_words=req.target_words
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.exception("Could not generate lesson guide: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


# ---------------------------------------------------------
# Feature: PDF-Grounded Quiz
# ---------------------------------------------------------
@router.post("/quiz", response_model=LessonQuizResponse)
async def get_lesson_quiz_endpoint(req: LessonQuizRequest):
    """Generate 3-5 multiple-choice questions grounded in the PDF for a lesson."""
    return study_service.generate_lesson_quiz(
        lesson_title=req.lesson_title,
        chapter_id=req.chapter_id,
        document_ids=req.document_ids,
        num_questions=req.num_questions
    )


@router.post("/quiz/verify", response_model=QuizVerifyResponse)
async def verify_quiz_endpoint(req: QuizVerifyRequest):
    """Score the quiz. If passed (>= 60%), automatically marks the chapter completed!"""
    total = len(req.questions)
    correct_count = 0
    results = []

    for q in req.questions:
        q_id_str = str(q.id)
        chosen = req.answers.get(q_id_str)
        is_correct = (chosen is not None and int(chosen) == int(q.correct_index))
        if is_correct:
            correct_count += 1
        results.append({
            "question_id": q.id,
            "question": q.question,
            "chosen_index": chosen,
            "correct_index": q.correct_index,
            "is_correct": is_correct,
            "explanation": q.explanation
        })

    pct = int(round((correct_count / total) * 100)) if total > 0 else 0
    passed = pct >= 60

    # If passed and chapter/subject IDs provided, mark chapter completed
    if passed and req.chapter_id and req.subject_id:
        try:
            study_db.update_chapter(
                subject_id=req.subject_id,
                chapter_id=req.chapter_id,
                status="completed"
            )
        except Exception as e:
            logger.warning("Could not auto-mark chapter complete: %s", e)

    return QuizVerifyResponse(
        score=correct_count,
        total=total,
        percentage=pct,
        passed=passed,
        results=results
    )
