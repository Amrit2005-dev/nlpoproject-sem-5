"""Pydantic schemas for Exam & Syllabus features:
- Study-Readiness Auditor
- Syllabus Planner & Subject/Chapter tracking
- Lesson Prerequisites & Quick Check
- Lesson Explainer
- PDF-Grounded Quiz
"""

from typing import Any
from pydantic import BaseModel, Field


# ---------------------------------------------------------
# Study-Readiness Auditor Schemas
# ---------------------------------------------------------
class TopicReportItem(BaseModel):
    id: str
    topic_name: str
    status: str = Field(description="'Covered' | 'Partial' | 'Missing'")
    max_similarity: float = 0.0
    notes_snippet: str | None = None
    suggested_reading: str | None = None


class SyllabusAuditRequest(BaseModel):
    syllabus_doc_id: str
    notes_doc_ids: list[str] = Field(default_factory=list)


class SyllabusAuditResponse(BaseModel):
    overall_coverage: int
    covered_count: int
    partial_count: int
    missing_count: int
    syllabus_filename: str
    notes_filenames: list[str] = Field(default_factory=list)
    topics: list[TopicReportItem] = Field(default_factory=list)


# ---------------------------------------------------------
# Exam & Syllabus Planner Schemas
# ---------------------------------------------------------
class ChapterItem(BaseModel):
    id: str
    number: int
    title: str
    status: str = Field(default="not_started", description="'not_started' | 'in_progress' | 'completed'")
    notes: str = ""
    prerequisites_summary: str | None = None


class SubjectItem(BaseModel):
    id: str
    name: str
    color: str = "#6366f1"
    icon_letter: str = "S"
    document_ids: list[str] = Field(default_factory=list)
    chapters: list[ChapterItem] = Field(default_factory=list)
    progress_pct: int = 0
    total_chapters: int = 0
    completed_chapters: int = 0
    in_progress_chapters: int = 0


class SubjectCreateRequest(BaseModel):
    name: str
    color: str = "#6366f1"
    document_id: str | None = None
    auto_extract_from_doc: bool = True
    manual_chapters: list[str] | None = None


class SubjectDocumentUpdateRequest(BaseModel):
    document_ids: list[str] = Field(min_length=1)


class ChapterUpdateRequest(BaseModel):
    status: str | None = None
    notes: str | None = None
    title: str | None = None


class PlannerOverviewResponse(BaseModel):
    overall_progress: int
    total_chapters: int
    completed_chapters: int
    in_progress_chapters: int
    subjects: list[SubjectItem]


# ---------------------------------------------------------
# Prerequisites & Quick Check Schemas
# ---------------------------------------------------------
class PrerequisiteItem(BaseModel):
    id: str
    title: str
    description: str
    details: str | None = None


class QuickCheckItem(BaseModel):
    question: str
    concept: str
    hint: str | None = None


class LessonPrerequisitesRequest(BaseModel):
    lesson_title: str
    subject_id: str | None = None
    document_ids: list[str] = Field(default_factory=list)


class LessonPrerequisitesResponse(BaseModel):
    lesson_title: str
    prerequisites: list[PrerequisiteItem] = Field(default_factory=list)
    why_important: str
    pipeline: list[str] = Field(default_factory=list)
    quick_check: QuickCheckItem


# ---------------------------------------------------------
# Lesson Explainer Schemas
# ---------------------------------------------------------
class LessonExplainRequest(BaseModel):
    lesson_title: str
    chapter_id: str | None = None
    document_ids: list[str] = Field(default_factory=list)
    difficulty: str = "standard"
    target_words: int = Field(default=1500, ge=500, le=3000)


class LessonExplainResponse(BaseModel):
    lesson_title: str
    content: str
    key_takeaways: list[str] = Field(default_factory=list)
    citations: list[dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------
# PDF-Grounded Quiz Schemas
# ---------------------------------------------------------
class QuizQuestion(BaseModel):
    id: int
    question: str
    options: list[str] = Field(description="List of 4 choices (A, B, C, D)")
    correct_index: int = Field(description="0 to 3 index of the correct choice")
    explanation: str


class LessonQuizRequest(BaseModel):
    lesson_title: str
    chapter_id: str | None = None
    document_ids: list[str] = Field(default_factory=list)
    num_questions: int = 3


class LessonQuizResponse(BaseModel):
    lesson_title: str
    questions: list[QuizQuestion] = Field(default_factory=list)


class QuizVerifyRequest(BaseModel):
    chapter_id: str | None = None
    subject_id: str | None = None
    answers: dict[str, int]
    questions: list[QuizQuestion]


class QuizVerifyResponse(BaseModel):
    score: int
    total: int
    percentage: int
    passed: bool
    results: list[dict[str, Any]]
