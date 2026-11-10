import React, { useState } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Award,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { studyApi } from '../../services/studyApi';

export default function LessonQuiz({
  quizData,
  subjectId,
  chapterId,
  onQuizCompleted
}) {
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

  if (!quizData || !quizData.questions) return null;

  const { lesson_title, questions = [] } = quizData;

  const handleSelectOption = (questionId, optionIndex) => {
    if (quizResult) return; // Prevent modifying after submission
    setSelectedAnswers(prev => ({
      ...prev,
      [String(questionId)]: optionIndex
    }));
  };

  const handleSubmit = async () => {
    if (Object.keys(selectedAnswers).length < questions.length) {
      alert('Please answer all quiz questions before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await studyApi.verifyQuiz(
        subjectId,
        chapterId,
        selectedAnswers,
        questions
      );
      setQuizResult(res);
      if (res.passed && onQuizCompleted) {
        onQuizCompleted(chapterId);
      }
    } catch (err) {
      alert(err.message || 'Error verifying quiz answers');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setQuizResult(null);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '820px',
        margin: '0 auto',
        width: '100%'
      }}
    >
      {/* Header Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
              PDF-Grounded Knowledge Check
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
              Short Quiz: {lesson_title}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Answer the questions below strictly based on your uploaded subject documents.
            </p>
          </div>

          {quizResult && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 18px',
                borderRadius: '12px',
                backgroundColor: quizResult.passed ? '#dcfce7' : '#fee2e2',
                color: quizResult.passed ? '#15803d' : '#b91c1c',
                border: `1px solid ${quizResult.passed ? '#bbf7d0' : '#fecaca'}`
              }}
            >
              <Award size={24} />
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800 }}>
                  {quizResult.score} / {quizResult.total} ({quizResult.percentage}%)
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700 }}>
                  {quizResult.passed ? 'PASSED & COMPLETED' : 'NEEDS REVIEW'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Questions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {questions.map((q, qIdx) => {
          const qIdStr = String(q.id);
          const chosenIdx = selectedAnswers[qIdStr];
          const resultDetail = quizResult?.results?.find(r => r.question_id === q.id);

          return (
            <div
              key={q.id || qIdx}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '20px',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#eef2ff',
                    color: '#6366f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0
                  }}
                >
                  {qIdx + 1}
                </span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {q.question}
                </span>
              </div>

              {/* Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {q.options.map((opt, optIdx) => {
                  const isSelected = chosenIdx === optIdx;
                  let optBg = 'var(--bg-main)';
                  let optBorder = 'var(--border-color)';
                  let optColor = 'var(--text-primary)';

                  if (quizResult) {
                    if (optIdx === q.correct_index) {
                      optBg = '#dcfce7';
                      optBorder = '#86efac';
                      optColor = '#15803d';
                    } else if (isSelected && optIdx !== q.correct_index) {
                      optBg = '#fee2e2';
                      optBorder = '#fca5a5';
                      optColor = '#b91c1c';
                    }
                  } else if (isSelected) {
                    optBg = '#eef2ff';
                    optBorder = '#6366f1';
                    optColor = '#4338ca';
                  }

                  const letters = ['A', 'B', 'C', 'D'];

                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleSelectOption(q.id, optIdx)}
                      disabled={!!quizResult}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: `1.5px solid ${optBorder}`,
                        backgroundColor: optBg,
                        color: optColor,
                        fontSize: '13.5px',
                        fontWeight: 600,
                        textAlign: 'left',
                        cursor: quizResult ? 'default' : 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <span
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(0,0,0,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                          flexShrink: 0
                        }}
                      >
                        {letters[optIdx]}
                      </span>
                      <span style={{ flex: 1 }}>{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Explanation note when verified */}
              {resultDetail && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: resultDetail.is_correct ? '#f0fdf4' : '#fff1f2',
                    border: `1px solid ${resultDetail.is_correct ? '#bbf7d0' : '#fecaca'}`,
                    fontSize: '12.5px',
                    color: resultDetail.is_correct ? '#166534' : '#991b1b'
                  }}
                >
                  <strong>{resultDetail.is_correct ? 'Correct! ' : 'Incorrect. '}</strong>
                  {resultDetail.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '32px' }}>
        {quizResult ? (
          <>
            <button
              onClick={handleRetake}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={16} />
              <span>Retake Quiz</span>
            </button>

            {onQuizCompleted && (
              <button
                onClick={() => onQuizCompleted(chapterId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
                }}
              >
                <span>Return to Syllabus Planner</span>
                <ArrowRight size={16} />
              </button>
            )}
          </>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 28px',
              borderRadius: '10px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              fontSize: '14px',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>Submit Quiz Answers</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

