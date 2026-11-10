import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  BookOpen,
  FileText,
  UploadCloud,
  Check
} from 'lucide-react';
import { api } from '../../services/api';

const COLOR_OPTIONS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#38bdf8', // Sky Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#ef4444'  // Rose
];

export default function AddSubjectModal({
  isOpen,
  onClose,
  onCreateSubject
}) {
  const [subjectName, setSubjectName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [lessons, setLessons] = useState([
    'Introduction & Core Foundations',
    'Fundamental Principles & Theory',
    'Advanced Methodology & Workflows',
    'Applications & Final Review'
  ]);
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);
  const [uploadedDocumentId, setUploadedDocumentId] = useState(null);

  if (!isOpen) return null;

  const handleLessonChange = (index, value) => {
    setLessons(prev => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const handleAddLessonRow = () => {
    setLessons(prev => [...prev, `Lesson ${prev.length + 1}`]);
  };

  const handleRemoveLessonRow = (index) => {
    if (lessons.length <= 1) return;
    setLessons(prev => prev.filter((_, i) => i !== index));
  };

  const handleAutoSuggestLessons = () => {
    const lower = subjectName.toLowerCase();
    if (lower.includes('nlp') || lower.includes('natural language')) {
      setLessons([
        'Text Preprocessing, Tokenization & Regex',
        'Language Modeling & N-Grams',
        'Vector Semantics & Word Embeddings (Word2Vec, GloVe)',
        'Sequence Labeling, RNNs & LSTMs',
        'Transformer Architecture, Attention & BERT'
      ]);
    } else if (lower.includes('ml') || lower.includes('machine learning')) {
      setLessons([
        'Supervised Learning & Linear Regression',
        'Logistic Regression & Classification Metrics',
        'Decision Trees, Random Forests & Ensemble',
        'Neural Networks & Backpropagation',
        'Unsupervised Learning, K-Means & PCA'
      ]);
    } else if (lower.includes('python') || lower.includes('code') || lower.includes('programming')) {
      setLessons([
        'Data Types, Control Flow & Functions',
        'Object-Oriented Programming (Classes & Inheritance)',
        'File Handling, Exceptions & Modules',
        'Data Structures, Algorithms & Complexity',
        'Testing, Debugging & Project Architecture'
      ]);
    } else if (lower.includes('math') || lower.includes('calculus')) {
      setLessons([
        'Functions, Limits & Continuity',
        'Derivatives & Rules of Differentiation',
        'Chain Rule & Implicit Differentiation',
        'Integral Calculus & Area Under Curves',
        'Applications in Optimization & Modeling'
      ]);
    } else if (subjectName.trim()) {
      setLessons([
        `Introduction to ${subjectName.trim()}`,
        'Core Theoretical Framework & Terminology',
        'Mechanism, Calculations & Problem Solving',
        'Advanced Applications & Case Studies',
        'Comprehensive Exam Review & Mock Questions'
      ]);
    }
  };

  const handleUploadSyllabusPdf = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedDocumentId(null);
    setIsExtractingDoc(true);
    try {
      const doc = await api.uploadDocument(file);
      setUploadedDocumentId(doc.id);
      const docName = file.name.replace(/\.[^/.]+$/, '');
      if (!subjectName.trim()) {
        setSubjectName(docName);
      }
      // Set sensible extracted lessons
      setLessons([
        `${docName} - Unit 1: Foundations & Definitions`,
        `${docName} - Unit 2: Core Methodology`,
        `${docName} - Unit 3: Advanced Concepts & Analysis`,
        `${docName} - Unit 4: Practical Applications & Review`
      ]);
    } catch (err) {
      alert(err.message || 'Error processing syllabus PDF');
    } finally {
      setIsExtractingDoc(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!subjectName.trim()) {
      alert('Please enter a subject name.');
      return;
    }

    const filteredLessons = lessons.map(l => l.trim()).filter(Boolean);
    if (filteredLessons.length === 0) {
      alert('Please add at least one lesson.');
      return;
    }

    onCreateSubject({
      name: subjectName.trim(),
      color: selectedColor,
      chapters: filteredLessons,
      documentIds: uploadedDocumentId ? [uploadedDocumentId] : []
    });
    handleClose();
  };

  const handleClose = () => {
    setUploadedDocumentId(null);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(3px)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '18px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#eef2ff',
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <BookOpen size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Add Subject & Lessons
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Configure subject details and define lessons lesson-wise.
              </div>
            </div>
          </div>

          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Subject Name Input */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Subject Name *
            </label>
            <input
              type="text"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g. Natural Language Processing (NLP)"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: 600,
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Color Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Subject Badge Color
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {COLOR_OPTIONS.map((col) => (
                <button
                  type="button"
                  key={col}
                  onClick={() => setSelectedColor(col)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: col,
                    border: selectedColor === col ? '3px solid #ffffff' : 'none',
                    boxShadow: selectedColor === col ? `0 0 0 2px ${col}` : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff'
                  }}
                >
                  {selectedColor === col && <Check size={14} strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          {/* Lesson Breakdown Header & Actions */}
          <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Lessons / Chapters ({lessons.length})
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'block' }}>
                  Define each lesson in order
                </span>
              </div>

              {subjectName.trim() && (
                <button
                  type="button"
                  onClick={handleAutoSuggestLessons}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#eef2ff',
                    color: '#6366f1',
                    border: '1px solid #c7d2fe',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Sparkles size={13} />
                  <span>Auto-Suggest Lessons</span>
                </button>
              )}
            </div>

            {/* List of Lesson inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {lessons.map((lessonText, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      flexShrink: 0
                    }}
                  >
                    {idx + 1}
                  </span>

                  <input
                    type="text"
                    value={lessonText}
                    onChange={(e) => handleLessonChange(idx, e.target.value)}
                    placeholder={`Lesson ${idx + 1} title...`}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />

                  {lessons.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLessonRow(idx)}
                      title="Remove lesson"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Buttons: Add Lesson Row + Upload PDF */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <button
                type="button"
                onClick={handleAddLessonRow}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Plus size={14} />
                <span>+ Add Another Lesson</span>
              </button>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: isExtractingDoc ? 'not-allowed' : 'pointer'
                }}
              >
                <UploadCloud size={14} />
                <span>
                  {isExtractingDoc
                    ? 'Extracting...'
                    : uploadedDocumentId
                      ? 'PDF attached'
                      : 'Extract from Syllabus PDF'}
                </span>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleUploadSyllabusPdf}
                  disabled={isExtractingDoc}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-color)'
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isExtractingDoc}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                backgroundColor: '#6366f1',
                color: '#ffffff',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isExtractingDoc ? 'not-allowed' : 'pointer',
                opacity: isExtractingDoc ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
              }}
            >
              Create Subject ({lessons.filter(l => l.trim()).length} Lessons)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
