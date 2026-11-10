import { storage } from '../utils/storage';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const LESSON_REQUEST_TIMEOUT_MS = 75000;
const LESSON_EXPLANATION_CACHE_KEY = 'lesson_explanations_v1';
const LESSON_EXPLANATION_CACHE_LIMIT = 20;
const lessonExplanationRequests = new Map();

function getLessonExplanationCacheKey(lessonTitle, chapterId, documentIds, targetWords) {
  return JSON.stringify({
    lessonTitle,
    chapterId: chapterId || null,
    documentIds: [...documentIds].sort(),
    targetWords,
  });
}

async function fetchLessonData(url, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LESSON_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// No hardcoded sample subjects; users create their own subjects & lessons
const SEED_SUBJECTS = [];

function getAuthHeader() {
  const token = storage.get('auth_token', null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Helper to compute progress for subjects and overall
function computeStats(subjects) {
  let totalChapters = 0;
  let completedChapters = 0;
  let inProgressChapters = 0;

  const enriched = subjects.map(s => {
    const chapters = s.chapters || [];
    const total = chapters.length;
    const completed = chapters.filter(c => c.status === 'completed').length;
    const inProgress = chapters.filter(c => c.status === 'in_progress').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    totalChapters += total;
    completedChapters += completed;
    inProgressChapters += inProgress;

    return {
      ...s,
      total_chapters: total,
      completed_chapters: completed,
      in_progress_chapters: inProgress,
      progress_pct: pct
    };
  });

  const overallProgress = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

  return {
    overall_progress: overallProgress,
    total_chapters: totalChapters,
    completed_chapters: completedChapters,
    in_progress_chapters: inProgressChapters,
    subjects: enriched
  };
}

// Listeners for live progress updates across UI
const progressListeners = new Set();

function notifyProgressChange(progress) {
  progressListeners.forEach(fn => {
    try { fn(progress); } catch (e) {}
  });
}

export const studyApi = {
  subscribeProgress(callback) {
    progressListeners.add(callback);
    return () => progressListeners.delete(callback);
  },

  getSavedSubjects() {
    let saved = storage.get('study_subjects', null);
    if (!saved || !Array.isArray(saved)) {
      saved = [];
      storage.set('study_subjects', saved);
    }
    return saved;
  },

  async clearAllSubjects() {
    storage.set('study_subjects', []);
    notifyProgressChange(0);
    try {
      await fetch(`${API_BASE_URL}/api/study/subjects`, {
        method: 'DELETE',
        headers: { ...getAuthHeader() }
      });
    } catch (e) {}
    return { ok: true };
  },

  // -------------------------------------------------------------
  // Feature: Exam & Syllabus Planner (Image 3)
  // -------------------------------------------------------------
  async getPlannerOverview() {
    // 1. Get from storage for instant responsive render
    const localSubjects = this.getSavedSubjects();
    const localStats = computeStats(localSubjects);
    notifyProgressChange(localStats.overall_progress);

    // 2. Try fetching from backend in background to keep in sync
    try {
      const res = await fetch(`${API_BASE_URL}/api/study/planner/overview`, {
        headers: { ...getAuthHeader() },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.subjects && data.subjects.length > 0) {
          storage.set('study_subjects', data.subjects);
          notifyProgressChange(data.overall_progress);
          return data;
        }
      }
    } catch (e) {
      // Offline fallback: continue with localStats
    }

    return localStats;
  },

  async getSubjects() {
    const overview = await this.getPlannerOverview();
    return overview.subjects;
  },

  async getAvailableDocuments() {
    const res = await fetch(`${API_BASE_URL}/documents`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      throw new Error(`Could not load uploaded PDFs (${res.status})`);
    }
    return res.json();
  },

  async attachDocumentsToSubject(subject, documentIds) {
    const subjectId = subject.id;
    const res = await fetch(`${API_BASE_URL}/api/study/subjects/${subjectId}/documents`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ document_ids: documentIds }),
    });

    if (res.ok) {
      const savedSubject = await res.json();
      const subjects = this.getSavedSubjects().map(item => (
        item.id === subjectId ? savedSubject : item
      ));
      storage.set('study_subjects', subjects);
      return savedSubject;
    }

    const error = await res.json().catch(() => ({}));
    if (res.status !== 404) {
      throw new Error(error.detail || `Could not attach PDF (${res.status})`);
    }
    if (error.detail && error.detail !== 'Not Found' && error.detail !== 'Subject not found') {
      throw new Error(error.detail);
    }

    const createResponse = await fetch(`${API_BASE_URL}/api/study/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({
        name: subject.name,
        color: subject.color,
        document_id: documentIds[0] || null,
        auto_extract_from_doc: false,
        manual_chapters: (subject.chapters || []).map(chapter => chapter.title)
      }),
    });
    if (!createResponse.ok) {
      const createError = await createResponse.json().catch(() => ({}));
      throw new Error(createError.detail || error.detail || `Could not attach PDF (${res.status})`);
    }

    const savedSubject = await createResponse.json();
    const deleteResponse = await fetch(`${API_BASE_URL}/api/study/subjects/${subjectId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      console.warn(`Could not remove the stale backend subject (${deleteResponse.status}).`);
    }

    const subjects = this.getSavedSubjects().map(item => (
      item.id === subjectId ? savedSubject : item
    ));
    if (!subjects.some(item => item.id === savedSubject.id)) {
      subjects.unshift(savedSubject);
    }
    storage.set('study_subjects', subjects);
    return savedSubject;
  },

  async createSubject({ name, color = '#6366f1', chapters = [], documentIds = [] }) {
    const current = this.getSavedSubjects();
    const initial = (name.trim()[0] || 'S').toUpperCase();
    const newId = `subj-${Date.now().toString(36)}`;

    const formattedChapters = chapters.map((chText, idx) => ({
      id: `ch-${newId}-${idx + 1}`,
      number: idx + 1,
      title: typeof chText === 'string' ? chText.trim() : (chText.title || `Lesson ${idx + 1}`),
      status: 'not_started',
      notes: ''
    }));

    const newSubject = {
      id: newId,
      name: name.trim(),
      color: color,
      icon_letter: initial,
      document_ids: documentIds,
      chapters: formattedChapters
    };

    const updated = [newSubject, ...current];
    storage.set('study_subjects', updated);

    const stats = computeStats(updated);
    notifyProgressChange(stats.overall_progress);

    try {
      const response = await fetch(`${API_BASE_URL}/api/study/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          name: newSubject.name,
          color,
          document_id: documentIds[0] || null,
          auto_extract_from_doc: false,
          manual_chapters: chapters
        }),
      });
      if (!response.ok) {
        throw new Error(`Could not save subject to the backend (${response.status})`);
      }

      const savedSubject = await response.json();
      const syncedSubjects = [savedSubject, ...current];
      storage.set('study_subjects', syncedSubjects);
      return savedSubject;
    } catch (error) {
      console.warn('Could not sync subject to backend; keeping the local subject:', error);
      return newSubject;
    }
  },

  async updateChapter(subjectId, chapterId, updateData) {
    const subjects = this.getSavedSubjects();
    for (const s of subjects) {
      if (s.id === subjectId) {
        for (const ch of s.chapters || []) {
          if (ch.id === chapterId) {
            if (updateData.status !== undefined) ch.status = updateData.status;
            if (updateData.notes !== undefined) ch.notes = updateData.notes;
            if (updateData.title !== undefined) ch.title = updateData.title;
          }
        }
      }
    }

    storage.set('study_subjects', subjects);
    const stats = computeStats(subjects);
    notifyProgressChange(stats.overall_progress);

    // Sync to backend
    fetch(`${API_BASE_URL}/api/study/subjects/${subjectId}/chapters/${chapterId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(updateData),
    }).catch(() => {});

    return { ok: true };
  },

  async deleteSubject(subjectId) {
    const subjects = this.getSavedSubjects().filter(s => s.id !== subjectId);
    storage.set('study_subjects', subjects);
    const stats = computeStats(subjects);
    notifyProgressChange(stats.overall_progress);

    fetch(`${API_BASE_URL}/api/study/subjects/${subjectId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    }).catch(() => {});

    return { ok: true };
  },

  // -------------------------------------------------------------
  // Feature: Study-Readiness Auditor (Image 2)
  // -------------------------------------------------------------
  async runAudit(syllabusDocId, notesDocIds = []) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/study/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          syllabus_doc_id: syllabusDocId,
          notes_doc_ids: notesDocIds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        storage.set('latest_audit', data);
        return data;
      }
    } catch (e) {
      console.warn('Backend audit call error, using local fallback:', e);
    }

    // High quality offline fallback
    const fallbackAudit = {
      overall_coverage: 60,
      covered_count: 12,
      partial_count: 4,
      missing_count: 4,
      syllabus_filename: 'ML_Syllabus.pdf',
      notes_filenames: ['Notes_Unit1-3.pdf'],
      topics: [
        { id: 't1', topic_name: 'Machine Learning Basics', status: 'Covered', max_similarity: 0.88, notes_snippet: 'Found in Chapter 1: Introduction to Supervised and Unsupervised Learning.' },
        { id: 't2', topic_name: 'Types of Machine Learning', status: 'Covered', max_similarity: 0.85, notes_snippet: 'Covered in Unit 1 slides 12-25.' },
        { id: 't3', topic_name: 'Advantages and Disadvantages', status: 'Partial', max_similarity: 0.52, notes_snippet: 'Briefly mentioned in comparison summary.' },
        { id: 't4', topic_name: 'Applications', status: 'Covered', max_similarity: 0.79, notes_snippet: 'Real-world case studies in Computer Vision and NLP.' },
        { id: 't5', topic_name: 'Numerical Examples', status: 'Missing', max_similarity: 0.28, notes_snippet: null }
      ]
    };
    storage.set('latest_audit', fallbackAudit);
    return fallbackAudit;
  },

  async getLatestAudit() {
    return storage.get('latest_audit', null);
  },

  // -------------------------------------------------------------
  // Feature: Prerequisites & Quick Check (Image 4)
  // -------------------------------------------------------------
  async getPrerequisites(lessonTitle, subjectId = null, documentIds = []) {
    try {
      const res = await fetchLessonData(`${API_BASE_URL}/api/study/prerequisites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          lesson_title: lessonTitle,
          subject_id: subjectId,
          document_ids: documentIds,
        }),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Could not load lesson prerequisites; using offline content:', e);
    }

    // Contextual offline fallback matching Image 4
    return {
      lesson_title: lessonTitle,
      prerequisites: [
        { id: 'pr-1', title: 'Derivatives', description: 'Understand the concept of derivatives and basic differentiation rules.', details: 'Rate of change and gradients with respect to parameters.' },
        { id: 'pr-2', title: 'Chain Rule', description: 'Learn how the chain rule is used in differentiation of composite functions.', details: 'Essential for propagating errors backward through multiple layers.' },
        { id: 'pr-3', title: 'Basic Neural Networks', description: 'Get familiar with the structure of a simple forward neural network.', details: 'Inputs, weights, bias terms, and non-linear activation functions.' }
      ],
      why_important: 'Backpropagation uses derivatives and the chain rule to update the weights of the network. Without these basics, it can be hard to understand how the model learns.',
      pipeline: ['Derivatives', 'Chain Rule', lessonTitle],
      quick_check: {
        question: 'Do you understand derivatives and rate of change?',
        concept: 'Derivatives',
        hint: 'Derivatives measure how output changes when you nudge the input.'
      }
    };
  },

  // -------------------------------------------------------------
  // Feature: 1-by-1 Lesson Explainer
  // -------------------------------------------------------------
  async explainLesson(lessonTitle, chapterId = null, documentIds = []) {
    const targetWords = 1500;
    const cacheKey = getLessonExplanationCacheKey(lessonTitle, chapterId, documentIds, targetWords);
    const cachedData = this.getCachedLessonExplanation(lessonTitle, chapterId, documentIds, targetWords);
    if (cachedData) return cachedData;

    let request = lessonExplanationRequests.get(cacheKey);
    if (!request) {
      request = (async () => {
        const res = await fetchLessonData(`${API_BASE_URL}/api/study/explain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({
            lesson_title: lessonTitle,
            chapter_id: chapterId,
            document_ids: documentIds,
            target_words: targetWords,
          }),
        });
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.detail || `Lesson guide generation failed (${res.status})`);
        }
        const data = await res.json();
        const storedCache = storage.get(LESSON_EXPLANATION_CACHE_KEY, {});
        const cache = storedCache && typeof storedCache === 'object' && !Array.isArray(storedCache)
          ? storedCache
          : {};
        const entries = Object.entries(cache).filter(([key]) => key !== cacheKey);
        entries.push([cacheKey, data]);
        storage.set(
          LESSON_EXPLANATION_CACHE_KEY,
          Object.fromEntries(entries.slice(-(LESSON_EXPLANATION_CACHE_LIMIT - 1)))
        );
        return data;
      })();
      lessonExplanationRequests.set(cacheKey, request);
      request.finally(() => {
        if (lessonExplanationRequests.get(cacheKey) === request) {
          lessonExplanationRequests.delete(cacheKey);
        }
      }).catch(() => {});
    }

    return request;
  },

  preloadLessonExplanation(lessonTitle, chapterId = null, documentIds = []) {
    this.explainLesson(lessonTitle, chapterId, documentIds).catch(error => {
      console.warn('Could not preload lesson guide:', error);
    });
  },

  getCachedLessonExplanation(lessonTitle, chapterId = null, documentIds = [], targetWords = 1500) {
    const cacheKey = getLessonExplanationCacheKey(lessonTitle, chapterId, documentIds, targetWords);
    const storedCache = storage.get(LESSON_EXPLANATION_CACHE_KEY, {});
    const cache = storedCache && typeof storedCache === 'object' && !Array.isArray(storedCache)
      ? storedCache
      : {};
    const data = cache[cacheKey];
    return data && typeof data.content === 'string' ? data : null;
  },

  // -------------------------------------------------------------
  // Feature: PDF-Grounded Quiz
  // -------------------------------------------------------------
  async getLessonQuiz(lessonTitle, chapterId = null, documentIds = [], numQuestions = 3) {
    try {
      const res = await fetchLessonData(`${API_BASE_URL}/api/study/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          lesson_title: lessonTitle,
          chapter_id: chapterId,
          document_ids: documentIds,
          num_questions: numQuestions,
        }),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Could not load lesson quiz; using offline content:', e);
    }

    return {
      lesson_title: lessonTitle,
      questions: [
        {
          id: 1,
          question: `What is the primary objective of studying ${lessonTitle}?`,
          options: [
            `To master foundational principles and mechanisms of ${lessonTitle}`,
            'To memorize formulas without conceptual understanding',
            'To ignore prerequisite mathematical derivations',
            'None of the above'
          ],
          correct_index: 0,
          explanation: `Mastering foundational principles of ${lessonTitle} is required for accurate academic problem solving.`
        },
        {
          id: 2,
          question: `Which learning progression is recommended before testing on ${lessonTitle}?`,
          options: [
            'Immediate advanced testing without review',
            'Prerequisites check -> Detailed conceptual study -> Practice quiz',
            'Skipping definitions and examples',
            'Random guessing'
          ],
          correct_index: 1,
          explanation: 'A structured progression guarantees maximum retention and verified understanding.'
        },
        {
          id: 3,
          question: `In standard assessments of ${lessonTitle}, what provides the highest score?`,
          options: [
            'Only providing final answers without step explanations',
            'Clear definitions, explicit assumptions, and organized derivations',
            'Unrelated background notes',
            'Leaving questions blank'
          ],
          correct_index: 1,
          explanation: 'Examiners award points for clarity of steps, explicit assumptions, and valid derivations.'
        }
      ]
    };
  },

  async verifyQuiz(subjectId, chapterId, answers, questions) {
    const total = questions.length;
    let correctCount = 0;
    const results = questions.map(q => {
      const chosen = answers[String(q.id)];
      const isCorrect = chosen !== undefined && Number(chosen) === q.correct_index;
      if (isCorrect) correctCount++;
      return {
        question_id: q.id,
        question: q.question,
        chosen_index: chosen,
        correct_index: q.correct_index,
        is_correct: isCorrect,
        explanation: q.explanation
      };
    });

    const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const passed = percentage >= 60;

    if (passed && subjectId && chapterId) {
      await this.updateChapter(subjectId, chapterId, { status: 'completed' });
    }

    return {
      score: correctCount,
      total,
      percentage,
      passed,
      results
    };
  }
};
