import React from 'react';
import {
  BookOpen,
  CheckCircle2,
  FileText,
  HelpCircle,
  ArrowRight,
  Sparkles,
  ExternalLink
} from 'lucide-react';

function renderInlineMarkdown(text) {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return <code key={index}>{token.slice(1, -1)}</code>;
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return <em key={index}>{token.slice(1, -1)}</em>;
    }
    return token;
  });
}

function renderLessonContent(content) {
  return content.split(/\r?\n/).map((line, index) => {
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const listItem = line.match(/^\s*(?:(-|\*|\+)|(\d+[.)]))\s+(.+)$/);
    if (/^\s*[-*_]{3,}\s*$/.test(line)) return null;
    if (heading) {
      const Heading = heading[1].length <= 2 ? 'h2' : 'h3';
      return (
        <Heading key={index} style={{ color: 'var(--text-primary)', margin: '20px 0 8px' }}>
          {renderInlineMarkdown(heading[2])}
        </Heading>
      );
    }
    if (listItem) {
      return (
        <div key={index} style={{ display: 'flex', gap: '8px', margin: '4px 0' }}>
          <span style={{ flexShrink: 0, color: 'var(--accent-primary)' }}>{listItem[2] || '•'}</span>
          <span>{renderInlineMarkdown(listItem[3])}</span>
        </div>
      );
    }
    return line.trim()
      ? <p key={index} style={{ margin: '8px 0' }}>{renderInlineMarkdown(line)}</p>
      : <div key={index} style={{ height: '8px' }} />;
  });
}

export default function LessonExplainer({
  explanationData,
  onProceedToQuiz
}) {
  if (!explanationData) return null;

  const {
    lesson_title,
    content,
    key_takeaways = [],
    citations = []
  } = explanationData;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '920px',
        margin: '0 auto',
        width: '100%'
      }}
    >
      {/* Lesson Explanation Content Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#eef2ff',
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <BookOpen size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>
              Detailed Lesson Guide
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              {lesson_title}
            </h1>
          </div>
        </div>

        {/* Formatted Markdown Content */}
        <div
          style={{
            fontSize: '14.5px',
            lineHeight: 1.7,
            color: 'var(--text-primary)',
            fontFamily: 'inherit'
          }}
          className="lesson-body"
        >
          {renderLessonContent(content)}
        </div>

        {/* Key Takeaways Section */}
        {key_takeaways.length > 0 && (
          <div
            style={{
              marginTop: '24px',
              padding: '18px',
              backgroundColor: 'var(--bg-main)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <CheckCircle2 size={18} color="#10b981" />
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Exam Essentials & Key Takeaways
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {key_takeaways.map((point, idx) => (
                <li key={idx} style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Source Citations */}
        {citations.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Verified Document Excerpts & Page Citations
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {citations.map((cite, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    fontSize: '12px',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <FileText size={14} color="#6366f1" />
                  <span>
                    <strong>{cite.filename}</strong> (Page {cite.page_number})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Button to proceed to quiz */}
      {onProceedToQuiz && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onProceedToQuiz}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              transition: 'all 0.18s'
            }}
          >
            <span>Take Post-Lesson Quiz</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
