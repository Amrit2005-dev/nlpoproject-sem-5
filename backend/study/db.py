"""Storage manager for Study & Syllabus Planner data:
Subjects, chapters, progress, notes, and audits.
Persists to data/study_store.json with default seed data.
"""

import json
import logging
from pathlib import Path
from collections.abc import Sequence
from typing import Any
import uuid

logger = logging.getLogger(__name__)

STORE_PATH = Path("data/study_store.json")

DEFAULT_SEED_SUBJECTS: list[dict[str, Any]] = []


def _load_data() -> dict[str, Any]:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if STORE_PATH.exists():
        try:
            return json.loads(STORE_PATH.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning("Could not read study_store.json, creating initial store: %s", e)

    initial_data = {
        "subjects": DEFAULT_SEED_SUBJECTS,
        "audits": []
    }
    _save_data(initial_data)
    return initial_data


def _save_data(data: dict[str, Any]) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def get_all_subjects() -> list[dict[str, Any]]:
    data = _load_data()
    subjects = data.get("subjects", [])
    
    # Calculate live progress for each subject
    for s in subjects:
        chapters = s.get("chapters", [])
        total = len(chapters)
        completed = sum(1 for c in chapters if c.get("status") == "completed")
        in_progress = sum(1 for c in chapters if c.get("status") == "in_progress")
        pct = int(round((completed / total) * 100)) if total > 0 else 0
        s["total_chapters"] = total
        s["completed_chapters"] = completed
        s["in_progress_chapters"] = in_progress
        s["progress_pct"] = pct

    return subjects


def get_subject_by_id(subject_id: str) -> dict[str, Any] | None:
    subjects = get_all_subjects()
    for s in subjects:
        if s.get("id") == subject_id:
            return s
    return None


def add_subject(name: str, chapters: Sequence[str | dict[str, Any]], color: str = "#6366f1", doc_ids: list[str] | None = None) -> dict[str, Any]:
    data = _load_data()
    subjects = data.get("subjects", [])
    
    initial = (name.strip()[0] if name.strip() else "S").upper()
    subj_id = f"subj-{uuid.uuid4().hex[:8]}"

    formatted_chapters = []
    for idx, ch in enumerate(chapters, 1):
        if isinstance(ch, str):
            formatted_chapters.append({
                "id": f"ch-{uuid.uuid4().hex[:6]}",
                "number": idx,
                "title": ch.strip(),
                "status": "not_started",
                "notes": ""
            })
        elif isinstance(ch, dict):
            formatted_chapters.append({
                "id": ch.get("id") or f"ch-{uuid.uuid4().hex[:6]}",
                "number": idx,
                "title": ch.get("title", f"Chapter {idx}"),
                "status": ch.get("status", "not_started"),
                "notes": ch.get("notes", "")
            })

    new_subj = {
        "id": subj_id,
        "name": name,
        "color": color,
        "icon_letter": initial,
        "document_ids": doc_ids or [],
        "chapters": formatted_chapters
    }
    subjects.append(new_subj)
    data["subjects"] = subjects
    _save_data(data)
    return get_subject_by_id(subj_id) or new_subj


def update_chapter(subject_id: str, chapter_id: str, status: str | None = None, notes: str | None = None, title: str | None = None) -> dict[str, Any] | None:
    data = _load_data()
    subjects = data.get("subjects", [])

    for s in subjects:
        if s.get("id") == subject_id:
            for ch in s.get("chapters", []):
                if ch.get("id") == chapter_id:
                    if status is not None:
                        ch["status"] = status
                    if notes is not None:
                        ch["notes"] = notes
                    if title is not None:
                        ch["title"] = title
                    data["subjects"] = subjects
                    _save_data(data)
                    return ch
    return None


def delete_subject(subject_id: str) -> bool:
    data = _load_data()
    subjects = data.get("subjects", [])
    filtered = [s for s in subjects if s.get("id") != subject_id]
    if len(filtered) != len(subjects):
        data["subjects"] = filtered
        _save_data(data)
        return True
    return False


def set_subject_document_ids(subject_id: str, document_ids: list[str]) -> dict[str, Any] | None:
    data = _load_data()
    subjects = data.get("subjects", [])
    for subject in subjects:
        if subject.get("id") == subject_id:
            subject["document_ids"] = document_ids
            data["subjects"] = subjects
            _save_data(data)
            return subject
    return None


def clear_all_subjects() -> bool:
    data = _load_data()
    data["subjects"] = []
    _save_data(data)
    return True


def save_audit_result(audit_res: dict[str, Any]) -> None:
    data = _load_data()
    audits = data.get("audits", [])
    audits.insert(0, audit_res)
    # keep last 10 audits
    data["audits"] = audits[:10]
    _save_data(data)


def get_latest_audit() -> dict[str, Any] | None:
    data = _load_data()
    audits = data.get("audits", [])
    return audits[0] if audits else None
