import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  Circle,
  Hourglass,
  Plus,
  FileText,
  Edit2,
  Trash2,
  ChevronRight,
  Sparkles,
  BookOpen,
  X
} from 'lucide-react';
import { studyApi } from '../../services/studyApi';
import LessonModal from './LessonModal';
import AddSubjectModal from './AddSubjectModal';

export default function SyllabusPlanner({ onOpenAuditor }) {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [overview, setOverview] = useState({
    overall_progress: 0,
    total_chapters: 0,
    completed_chapters: 0,
    in_progress_chapters: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  // Lesson Modal State
  const [activeLessonChapter, setActiveLessonChapter] = useState(null);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);

  // Notes Modal State
  const [notesModalChapter, setNotesModalChapter] = useState(null);
  const [noteContent, setNoteContent] = useState('');

  // Add Subject Modal State
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);

  const loadData = async (preselectId = null) => {
    try {
      const data = await studyApi.getPlannerOverview();
      const loadedSubjects = data.subjects || [];
      setSubjects(loadedSubjects);
      setOverview({
        overall_progress: data.overall_progress,
        total_chapters: data.total_chapters,
        completed_chapters: data.completed_chapters,
        in_progress_chapters: data.in_progress_chapters
      });

      if (preselectId) {
        setSelectedSubjectId(preselectId);
      } else if (!selectedSubjectId && loadedSubjects.length > 0) {
        // Auto-select first subject
        setSelectedSubjectId(loadedSubjects[0].id);
      }
    } catch (err) {
      console.warn('Could not load planner data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = studyApi.subscribeProgress((newProg) => {
      setOverview(prev => ({ ...prev, overall_progress: newProg }));
    });
    return () => unsubscribe();
  }, []);

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId) || subjects[0] || null;

  const handleUpdateChapterStatus = async (chapterId, newStatus) => {
    if (!selectedSubject) return;
    try {
      await studyApi.updateChapter(selectedSubject.id, chapterId, { status: newStatus });
      await loadData(selectedSubject.id);
    } catch (err) {
      alert('Could not update chapter status');
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedSubject || !notesModalChapter) return;
    try {
      await studyApi.updateChapter(selectedSubject.id, notesModalChapter.id, { notes: noteContent });
      setNotesModalChapter(null);
      await loadData(selectedSubject.id);
    } catch (err) {
      alert('Could not save chapter note');
    }
  };

  const handleCreateSubjectWithLessons = async ({ name, color, chapters, documentIds = [] }) => {
    try {
      const created = await studyApi.createSubject({ name, color, chapters, documentIds });
      await loadData(created.id);
    } catch (err) {
      alert(err.message || 'Could not create subject');
    }
  };

  const handleAddChapterToSubject = async () => {
    if (!selectedSubject) return;
    const title = prompt('Enter new lesson/chapter title:');
    if (!title || !title.trim()) return;

    const existingTitles = selectedSubject.chapters?.map(c => c.title) || [];
    const updatedChapters = [...existingTitles, title.trim()];

    // Add via recreating or updating
    await studyApi.createSubject({
      name: selectedSubject.name,
      color: selectedSubject.color,
      chapters: updatedChapters,
      documentIds: selectedSubject.document_ids || []
    });
    await loadData(selectedSubject.id);
  };

  const handleDeleteSubject = async (e, subjectId) => {
    e.stopPropagation();
    if (window.confirm('Delete this subject and its chapters?')) {
      try {
        await studyApi.deleteSubject(subjectId);
        await loadData();
      } catch (e) {
        alert('Could not delete subject');
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Remove all subjects and start fresh with your own profile subjects?')) {
      try {
        await studyApi.clearAllSubjects();
        setSelectedSubjectId(null);
        await loadData();
      } catch (e) {
        alert('Could not clear subjects');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Top Banner / Actions matching Image 3 */}
      <div
        style={{
          padding: '16px 24px',
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Clock size={20} color="#6366f1" />
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Exam Countdown & Syllabus Planner
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={onOpenAuditor}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#eef2ff',
              color: '#6366f1',
              border: '1px solid #c7d2fe',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <Sparkles size={16} />
            <span>Open Study-Readiness Auditor</span>
          </button>

          {subjects.length > 0 && (
            <button
              onClick={handleClearAll}
              title="Remove all subjects and start fresh"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-main)',
                color: '#ef4444',
                border: '1px solid var(--border-color)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Trash2 size={14} />
              <span>Clear All</span>
            </button>
          )}

          <button
            onClick={() => setIsAddSubjectOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: '#6366f1',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
            }}
          >
            <Plus size={16} />
            <span>+ Add Subject</span>
          </button>
        </div>
      </div>

      {/* Main Two-Panel Layout matching Image 3 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Panel: Overall Progress + Subject List */}
        <div
          style={{
            width: '380px',
            borderRight: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-sidebar)',
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            flexShrink: 0
          }}
        >
          {/* Overall Progress Card matching Image 3 */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '8px', height: '14px', backgroundColor: '#8b5cf6', borderRadius: '4px' }} />
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Overall Progress
              </span>
            </div>

            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {overview.overall_progress}% <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>Completed</span>
            </div>

            {/* Progress Bar */}
            <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--bg-main)', borderRadius: '9999px', overflow: 'hidden', marginBottom: '16px' }}>
              <div
                style={{
                  height: '100%',
                  width: `${overview.overall_progress}%`,
                  backgroundColor: '#8b5cf6',
                  borderRadius: '9999px',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>

            {/* Stats below progress bar matching Image 3 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>{overview.total_chapters}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Total Chapters</div>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#10b981' }}>{overview.completed_chapters}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Completed</div>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#f59e0b' }}>{overview.in_progress_chapters}</div>
                <div style={{ color: 'var(--text-secondary)' }}>In Progress</div>
              </div>
            </div>
          </div>

          {/* Subjects List Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Your Subjects ({subjects.length})
            </span>
            {subjects.length > 0 && (
              <button
                onClick={handleClearAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Clear all
              </button>
            )}
          </div>

          {/* Subjects List matching Image 3 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {subjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                No subjects yet. Click <strong>+ Add Subject</strong> to start adding subjects and lessons!
              </div>
            ) : (
              subjects.map((subj) => {
                const isSelected = subj.id === selectedSubject?.id;
                return (
                  <div
                    key={subj.id}
                    onClick={() => setSelectedSubjectId(subj.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: `1px solid ${isSelected ? 'var(--accent-primary, #6366f1)' : 'var(--border-color)'}`,
                      backgroundColor: isSelected ? 'var(--bg-active, #f3f0ff)' : 'var(--bg-card)',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '10px',
                          backgroundColor: subj.color ? `${subj.color}25` : '#e0e7ff',
                          color: subj.color || '#4338ca',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 800,
                          flexShrink: 0
                        }}
                      >
                        {subj.icon_letter || subj.name.slice(0, 1)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {subj.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          📖 {subj.total_chapters || subj.chapters?.length || 0} Chapters
                        </div>

                        {/* Mini Progress Bar */}
                        <div style={{ height: '4px', width: '90%', backgroundColor: 'var(--bg-main)', borderRadius: '9999px', marginTop: '6px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${subj.progress_pct || 0}%`,
                              backgroundColor: subj.color || '#6366f1',
                              borderRadius: '9999px'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {subj.progress_pct || 0}%
                      </span>
                      {isSelected && <ChevronRight size={16} color="var(--accent-primary, #6366f1)" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Selected Subject & Chapter Cards Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: 'var(--bg-main)' }}>
          {selectedSubject ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
              {/* Header Title + Add Chapter */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {selectedSubject.name}
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleAddChapterToSubject}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={15} />
                    <span>Add Lesson</span>
                  </button>

                  <button
                    onClick={(e) => handleDeleteSubject(e, selectedSubject.id)}
                    title="Delete Subject"
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card)',
                      color: '#ef4444',
                      border: '1px solid var(--border-color)',
                      fontSize: '12.5px',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Syllabus Completion Card matching Image 3 */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Syllabus Completion
                  </span>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      backgroundColor: selectedSubject.progress_pct === 100 ? '#dcfce7' : '#e0e7ff',
                      color: selectedSubject.progress_pct === 100 ? '#15803d' : '#4338ca',
                      fontSize: '11px',
                      fontWeight: 700
                    }}
                  >
                    {selectedSubject.progress_pct === 100 ? '● Completed' : '● In Progress'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {selectedSubject.progress_pct || 0}%
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Done
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {selectedSubject.completed_chapters || 0}/{selectedSubject.total_chapters || selectedSubject.chapters?.length || 0} Lessons
                  </span>
                </div>

                {/* Progress Bar */}
                <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--bg-main)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${selectedSubject.progress_pct || 0}%`,
                      backgroundColor: selectedSubject.color || '#10b981',
                      borderRadius: '9999px',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>

              {/* Chapters Cards Grid matching Image 3 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '16px'
                }}
              >
                {selectedSubject.chapters?.map((ch, idx) => {
                  let topBorderColor = '#ef4444'; // red (not started)
                  let statusBadgeColor = '#ef4444';
                  let StatusIcon = Circle;

                  if (ch.status === 'completed') {
                    topBorderColor = '#10b981'; // green
                    statusBadgeColor = '#10b981';
                    StatusIcon = CheckCircle2;
                  } else if (ch.status === 'in_progress') {
                    topBorderColor = '#f59e0b'; // yellow
                    statusBadgeColor = '#f59e0b';
                    StatusIcon = Hourglass;
                  }

                  return (
                    <div
                      key={ch.id || idx}
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderTop: `4px solid ${topBorderColor}`,
                        borderRadius: '14px',
                        padding: '16px',
                        boxShadow: 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                    >
                      {/* Top Row: Title + Hourglass/Icon */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            Lesson {ch.number || idx + 1}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                            {ch.title}
                          </div>
                        </div>

                        <StatusIcon size={18} color={statusBadgeColor} />
                      </div>

                      {/* Status Selection Buttons (⭕ Not Started, ⌛ In Progress, ✅ Completed) */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '16px',
                          padding: '8px',
                          backgroundColor: 'var(--bg-main)',
                          borderRadius: '8px'
                        }}
                      >
                        <button
                          onClick={() => handleUpdateChapterStatus(ch.id, 'not_started')}
                          title="Set Not Started"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: ch.status === 'not_started' ? '#ef4444' : 'var(--text-secondary)'
                          }}
                        >
                          <Circle size={18} fill={ch.status === 'not_started' ? '#fee2e2' : 'none'} />
                        </button>

                        <button
                          onClick={() => handleUpdateChapterStatus(ch.id, 'in_progress')}
                          title="Set In Progress"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: ch.status === 'in_progress' ? '#f59e0b' : 'var(--text-secondary)'
                          }}
                        >
                          <Hourglass size={18} />
                        </button>

                        <button
                          onClick={() => handleUpdateChapterStatus(ch.id, 'completed')}
                          title="Set Completed"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: ch.status === 'completed' ? '#10b981' : 'var(--text-secondary)'
                          }}
                        >
                          <CheckCircle2 size={18} />
                        </button>
                      </div>

                      {/* Primary Action: Start Study Lesson */}
                      <button
                        onClick={() => {
                          setActiveLessonChapter(ch);
                          setIsLessonModalOpen(true);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '9px 12px',
                          backgroundColor: '#6366f1',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(99, 102, 241, 0.25)',
                          transition: 'all 0.15s'
                        }}
                      >
                        <BookOpen size={14} />
                        <span>Study Lesson & Quiz</span>
                      </button>

                      {/* Bottom Action Links matching Image 3: Notes, Add Note, Edit, Delete */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: '8px',
                          borderTop: '1px solid var(--border-color)',
                          fontSize: '11.5px',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        <button
                          onClick={() => {
                            setNotesModalChapter(ch);
                            setNoteContent(ch.notes || '');
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          <FileText size={12} />
                          <span>Notes</span>
                        </button>

                        <button
                          onClick={() => {
                            const newTitle = prompt('Edit lesson title:', ch.title);
                            if (newTitle && newTitle.trim()) {
                              studyApi.updateChapter(selectedSubject.id, ch.id, { title: newTitle.trim() }).then(() => loadData(selectedSubject.id));
                            }
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Edit2 size={12} />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm('Delete this lesson?')) {
                              // filter out chapter
                              const remaining = selectedSubject.chapters.filter(c => c.id !== ch.id).map(c => c.title);
                              studyApi.createSubject({
                                name: selectedSubject.name,
                                color: selectedSubject.color,
                                chapters: remaining
                              }).then(() => loadData(selectedSubject.id));
                            }
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
              <BookOpen size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                No Subject Selected
              </div>
              <div style={{ fontSize: '13px', marginTop: '4px', marginBottom: '16px' }}>
                Add your first subject and its lesson breakdown to start tracking!
              </div>
              <button
                onClick={() => setIsAddSubjectOpen(true)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                + Add Subject & Lessons
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lesson Modal (Prerequisites -> Explainer -> Quiz) */}
      <LessonModal
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        subject={selectedSubject}
        chapter={activeLessonChapter}
        onSubjectUpdated={(previousSubjectId, updatedSubject) => {
          setSubjects(currentSubjects => currentSubjects.map(subject => (
            subject.id === previousSubjectId ? updatedSubject : subject
          )));
          setSelectedSubjectId(updatedSubject.id);
          const updatedChapter = updatedSubject.chapters?.find(
            chapter => chapter.title === activeLessonChapter?.title
          );
          if (updatedChapter) setActiveLessonChapter(updatedChapter);
        }}
        onChapterCompleted={() => {
          loadData(selectedSubject?.id);
        }}
      />

      {/* Add Subject Modal with Lesson-wise input */}
      <AddSubjectModal
        isOpen={isAddSubjectOpen}
        onClose={() => setIsAddSubjectOpen(false)}
        onCreateSubject={handleCreateSubjectWithLessons}
      />

      {/* Notes Modal */}
      {notesModalChapter && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '500px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Lesson Notes: {notesModalChapter.title}
              </h3>
              <button onClick={() => setNotesModalChapter(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Add your study notes, key formulas, or reminders for this lesson..."
              rows={6}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '13.5px',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button
                onClick={() => setNotesModalChapter(null)}
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                style={{ padding: '8px 18px', borderRadius: '8px', backgroundColor: '#6366f1', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
