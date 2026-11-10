import React, { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { api } from '../../services/api';
import { studyApi } from '../../services/studyApi';
import PrerequisitesCard from './PrerequisitesCard';
import LessonExplainer from './LessonExplainer';
import LessonQuiz from './LessonQuiz';

export default function LessonModal({
  isOpen,
  onClose,
  subject,
  chapter,
  onChapterCompleted,
  onSubjectUpdated
}) {
  const [currentStep, setCurrentStep] = useState('prerequisites'); // 'prerequisites' | 'explain' | 'quiz'
  const [isLoading, setIsLoading] = useState(true);
  const [prereqData, setPrereqData] = useState(null);
  const [explanationData, setExplanationData] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [activeDocumentIds, setActiveDocumentIds] = useState(subject?.document_ids || []);
  const [isResolvingDocument, setIsResolvingDocument] = useState(false);
  const [isLinkingDocument, setIsLinkingDocument] = useState(false);
  const [documentLinkError, setDocumentLinkError] = useState('');
  const documentIdsKey = JSON.stringify(activeDocumentIds);
  const lessonKey = `${subject?.id || ''}:${chapter?.id || ''}:${chapter?.title || ''}:${documentIdsKey}`;

  useEffect(() => {
    setActiveDocumentIds(subject?.document_ids || []);
  }, [subject?.id, JSON.stringify(subject?.document_ids || [])]);

  useEffect(() => {
    if (!isOpen || currentStep !== 'explain' || activeDocumentIds.length > 0) return;

    let isActive = true;
    setIsResolvingDocument(true);
    setDocumentLinkError('');
    studyApi.getAvailableDocuments()
      .then(documents => {
        const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
        const subjectName = normalize(subject?.name || '');
        const matchingDocument = documents.find(document => {
          if (!document.filename?.toLowerCase().endsWith('.pdf')) return false;
          const filename = (document.filename || '').replace(/\.[^.]+$/, '');
          return normalize(filename) === subjectName;
        });

        if (!isActive || !matchingDocument) return;
        setIsLinkingDocument(true);
        return studyApi.attachDocumentsToSubject(subject, [matchingDocument.id])
          .then(updatedSubject => {
            if (!isActive) return;
            setActiveDocumentIds(updatedSubject.document_ids || [matchingDocument.id]);
            setDocumentLinkError('');
            if (onSubjectUpdated) onSubjectUpdated(subject.id, updatedSubject);
          });
      })
      .catch(error => {
        console.error('Could not connect the subject PDF to the lesson guide:', error);
        if (isActive) setDocumentLinkError(error.message);
      })
      .finally(() => {
        if (isActive) {
          setIsResolvingDocument(false);
          setIsLinkingDocument(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [isOpen, currentStep, subject?.id, subject?.name, activeDocumentIds.length]);

  useEffect(() => {
    if (!isOpen || !chapter || activeDocumentIds.length === 0) return;
    studyApi.preloadLessonExplanation(chapter.title, chapter.id, activeDocumentIds);
  }, [isOpen, chapter?.id, chapter?.title, documentIdsKey]);

  useEffect(() => {
    if (!isOpen || !chapter) return;

    let isActive = true;
    const documentIds = activeDocumentIds;
    if (currentStep === 'explain' && documentIds.length === 0) {
      setIsLoading(false);
      setLoadError('');
      return () => {
        isActive = false;
      };
    }

    const cachedData = {
      prerequisites: prereqData,
      explain: explanationData,
      quiz: quizData
    }[currentStep];

    if (cachedData?.lessonKey === lessonKey) {
      setIsLoading(false);
      setLoadError('');
      return () => {
        isActive = false;
      };
    }

    if (currentStep === 'explain') {
      const savedExplanation = studyApi.getCachedLessonExplanation(
        chapter.title,
        chapter.id,
        documentIds
      );
      if (savedExplanation) {
        setExplanationData({ lessonKey, data: savedExplanation });
        setIsLoading(false);
        setLoadError('');
        return () => {
          isActive = false;
        };
      }
    }

    setIsLoading(true);
    setLoadError('');

    async function loadStep() {
      try {
        if (currentStep === 'prerequisites') {
          const data = await studyApi.getPrerequisites(chapter.title, subject?.id, documentIds);
          if (isActive) setPrereqData({ lessonKey, data });
        } else if (currentStep === 'explain') {
          const data = await studyApi.explainLesson(chapter.title, chapter.id, documentIds);
          if (isActive) setExplanationData({ lessonKey, data });
        } else {
          const data = await studyApi.getLessonQuiz(chapter.title, chapter.id, documentIds);
          if (isActive) setQuizData({ lessonKey, data });
        }
      } catch (err) {
        console.error(`Failed to load lesson ${currentStep}:`, err);
        if (isActive) setLoadError(err.message || 'Could not load this lesson step. Please try again.');
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadStep();
    return () => {
      isActive = false;
    };
  }, [isOpen, currentStep, chapter?.id, chapter?.title, subject?.id, documentIdsKey, lessonKey, activeDocumentIds, prereqData, explanationData, quizData, retryCount]);

  const handleUploadSubjectPdf = async event => {
    const file = event.target.files?.[0];
    if (!file || !subject?.id) return;

    setIsLinkingDocument(true);
    setDocumentLinkError('');
    try {
      const uploadedDocument = await api.uploadDocument(file);
      const updatedSubject = await studyApi.attachDocumentsToSubject(subject, [uploadedDocument.id]);
      setActiveDocumentIds(updatedSubject.document_ids || [uploadedDocument.id]);
      if (onSubjectUpdated) onSubjectUpdated(subject.id, updatedSubject);
      setExplanationData(null);
    } catch (error) {
      console.error('Could not upload and attach the subject PDF:', error);
      setDocumentLinkError(error.message || 'Could not upload the PDF.');
    } finally {
      setIsLinkingDocument(false);
      event.target.value = '';
    }
  };

  if (!isOpen || !chapter) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1060px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-main, #f8fafc)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          border: '1px solid var(--border-color)'
        }}
      >
        {/* Modal Top Bar */}
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
          {/* Breadcrumb Steps Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {subject?.name || 'Subject'}
            </span>
            <ChevronRight size={14} color="var(--text-secondary)" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {chapter.title}
            </span>

            {/* Step indicators */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '20px' }}>
              <button
                onClick={() => setCurrentStep('prerequisites')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: currentStep === 'prerequisites' ? '#eef2ff' : 'transparent',
                  color: currentStep === 'prerequisites' ? '#6366f1' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                1. Prerequisites
              </button>
              <span style={{ color: 'var(--text-secondary)' }}>/</span>
              <button
                onClick={() => setCurrentStep('explain')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: currentStep === 'explain' ? '#eef2ff' : 'transparent',
                  color: currentStep === 'explain' ? '#6366f1' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                2. Lesson Guide
              </button>
              <span style={{ color: 'var(--text-secondary)' }}>/</span>
              <button
                onClick={() => setCurrentStep('quiz')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: currentStep === 'quiz' ? '#ecfdf5' : 'transparent',
                  color: currentStep === 'quiz' ? '#10b981' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                3. Short Quiz
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '360px', gap: '14px' }}>
              <Loader2 size={36} className="animate-spin" color="#6366f1" />
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {currentStep === 'explain'
                  ? 'Finding the most relevant PDF passages and preparing your lesson...'
                  : `Loading ${currentStep === 'prerequisites' ? 'prerequisites' : 'quiz'}...`}
              </div>
            </div>
          ) : isResolvingDocument ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '14px', color: 'var(--text-secondary)' }}>
              <Loader2 size={30} className="animate-spin" color="#6366f1" />
              <p style={{ margin: 0 }}>Finding the PDF already uploaded for {subject?.name}...</p>
            </div>
          ) : currentStep === 'explain' && activeDocumentIds.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '14px', color: 'var(--text-secondary)' }}>
              <p style={{ margin: 0, textAlign: 'center' }}>
                {documentLinkError
                  ? `Could not find a matching PDF for ${subject?.name}. Upload the PDF for this subject to continue.`
                  : `No uploaded PDF matches ${subject?.name}. Upload its PDF here to continue.`}
              </p>
              <label style={{ padding: '9px 16px', borderRadius: '8px', backgroundColor: '#6366f1', color: '#fff', fontWeight: 700, cursor: isLinkingDocument ? 'wait' : 'pointer', opacity: isLinkingDocument ? 0.6 : 1 }}>
                {isLinkingDocument ? 'Uploading PDF...' : 'Upload this subject PDF'}
                <input
                  type="file"
                  accept=".pdf"
                  disabled={isLinkingDocument}
                  onChange={handleUploadSubjectPdf}
                  style={{ display: 'none' }}
                />
              </label>
              {documentLinkError && <p role="alert" style={{ color: '#ef4444', margin: 0 }}>{documentLinkError}</p>}
            </div>
          ) : loadError ? (
            <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '240px', gap: '12px', color: 'var(--text-secondary)' }}>
              <p>{loadError}</p>
              <button
                type="button"
                onClick={() => setRetryCount(count => count + 1)}
                style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {currentStep === 'prerequisites' && (
                <PrerequisitesCard
                  prereqData={prereqData?.lessonKey === lessonKey ? prereqData.data : null}
                  onProceedToExplanation={() => setCurrentStep('explain')}
                />
              )}

              {currentStep === 'explain' && (
                <LessonExplainer
                  explanationData={explanationData?.lessonKey === lessonKey ? explanationData.data : null}
                  onProceedToQuiz={() => setCurrentStep('quiz')}
                />
              )}

              {currentStep === 'quiz' && (
                <LessonQuiz
                  quizData={quizData?.lessonKey === lessonKey ? quizData.data : null}
                  subjectId={subject?.id}
                  chapterId={chapter.id}
                  onQuizCompleted={(chId) => {
                    if (onChapterCompleted) onChapterCompleted(chId);
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
