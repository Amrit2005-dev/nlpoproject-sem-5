import React, { useState } from 'react';
import {
  CheckCircle,
  HelpCircle,
  ArrowRight,
  BookOpen,
  Info,
  ChevronRight,
  Sparkles,
  Check,
  RotateCcw
} from 'lucide-react';

export default function PrerequisitesCard({
  prereqData,
  onProceedToExplanation
}) {
  const [activePrereqDetails, setActivePrereqDetails] = useState(null);
  const [quickCheckAnswer, setQuickCheckAnswer] = useState(null); // 'yes' | 'no'

  if (!prereqData) return null;

  const {
    lesson_title,
    prerequisites = [],
    why_important,
    pipeline = [],
    quick_check = {}
  } = prereqData;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px',
        alignItems: 'stretch'
      }}
    >
      {/* Left Column: Recommended Prerequisites matching Image 4 */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}
          >
            <Check size={16} strokeWidth={3} />
          </div>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Recommended Prerequisites
          </h2>
        </div>

        {/* Prerequisites items list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
          {prerequisites.map((item, idx) => {
            const isDetailsOpen = activePrereqDetails === item.id;
            return (
              <div
                key={item.id || idx}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  backgroundColor: 'var(--bg-main)',
                  transition: 'border-color 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        flexShrink: 0
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.4 }}>
                        {item.description}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setActivePrereqDetails(isDetailsOpen ? null : item.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--accent-primary, #6366f1)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    {isDetailsOpen ? 'Hide' : 'Learn More'}
                  </button>
                </div>

                {/* Expanded Details */}
                {isDetailsOpen && (
                  <div
                    style={{
                      marginTop: '10px',
                      paddingTop: '10px',
                      borderTop: '1px dashed var(--border-color)',
                      fontSize: '12.5px',
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-card)',
                      padding: '8px 12px',
                      borderRadius: '8px'
                    }}
                  >
                    {item.details || 'Foundational core concept. Make sure you understand the primary definitions and formulas.'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Why these are important? + Pipeline + Quick Check matching Image 4 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}
      >
        {/* Why Important & Pipeline Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px 0' }}>
            Why these are important?
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 18px 0' }}>
            {why_important}
          </p>

          {/* Visual Concept Flow Pipeline matching Image 4 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              padding: '14px',
              backgroundColor: 'var(--bg-main)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}
          >
            {pipeline.map((step, idx) => (
              <React.Fragment key={idx}>
                <div
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    backgroundColor: idx === pipeline.length - 1 ? '#e0e7ff' : 'var(--bg-card)',
                    color: idx === pipeline.length - 1 ? '#4338ca' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {step}
                </div>
                {idx < pipeline.length - 1 && (
                  <ChevronRight size={16} color="var(--text-secondary)" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Quick Check Card matching Image 4 */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          {/* Cute Mascot/Avatar Badge */}
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              backgroundColor: '#eef2ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              flexShrink: 0
            }}
          >
            🧙‍♀️
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Quick Check
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              {quick_check.question || `Do you feel ready for ${lesson_title}?`}
            </div>

            {quickCheckAnswer === 'no' && quick_check.hint && (
              <div style={{ fontSize: '12px', color: '#b45309', backgroundColor: '#fef3c7', padding: '6px 10px', borderRadius: '6px', marginTop: '8px' }}>
                💡 Tip: {quick_check.hint}
              </div>
            )}

            {quickCheckAnswer === 'yes' && (
              <div style={{ fontSize: '12px', color: '#15803d', backgroundColor: '#dcfce7', padding: '6px 10px', borderRadius: '6px', marginTop: '8px' }}>
                🎉 Great! You are ready to start this lesson.
              </div>
            )}

            {/* Response Buttons matching Image 4 */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button
                onClick={() => setQuickCheckAnswer('yes')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  backgroundColor: quickCheckAnswer === 'yes' ? '#10b981' : '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Yes, I do
              </button>

              <button
                onClick={() => setQuickCheckAnswer('no')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Not yet
              </button>
            </div>
          </div>
        </div>

        {/* Start Lesson Button */}
        {onProceedToExplanation && (
          <button
            onClick={onProceedToExplanation}
            style={{
              padding: '14px',
              backgroundColor: '#6366f1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
              transition: 'all 0.18s'
            }}
          >
            <span>Proceed to Lesson Explanation</span>
            <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

