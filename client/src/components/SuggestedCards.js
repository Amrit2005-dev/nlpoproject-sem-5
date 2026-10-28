import React from 'react';
import { FileText, Sparkles, Compass } from 'lucide-react';

export default function SuggestedCards({ onSelectCard, onOpenSavedFiles }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        width: '100%',
        maxWidth: '920px',
        margin: '0 auto',
        padding: '0 16px'
      }}
    >
      {/* Card 1: Previously viewed files */}
      <div
        onClick={() => {
          if (onOpenSavedFiles) onOpenSavedFiles();
          else onSelectCard('Show me my previously viewed files and documents');
        }}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '20px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '120px'
        }}
        className="suggested-card"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
          <FileText size={18} style={{ color: 'var(--text-subtle)' }} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Previously viewed files</span>
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--text-subtle)', marginTop: '12px' }}>
          2 files available • UX Strategy Brief, IndicRAG Benchmark
        </div>
      </div>

      {/* Card 2: Summarize your last meeting */}
      <div
        onClick={() => onSelectCard('Can you summarize my last meeting (UX Strategy Meet up)?')}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '20px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '120px'
        }}
        className="suggested-card"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-sparkle)' }}>
          <Sparkles size={16} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Summarize your last meeting</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
          <div style={{ position: 'relative' }}>
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"
              alt="UX Strategy"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />
            <span
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '9px',
                height: '9px',
                backgroundColor: '#10b981',
                borderRadius: '50%',
                border: '2px solid var(--bg-card)'
              }}
            />
          </div>

          <div>
            <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              UX Strategy Meet up
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px' }}>
              1 Apr 2025, 14:00 pm
            </p>
          </div>
        </div>
      </div>

      {/* Card 3: Suggested Task */}
      <div
        onClick={() => onSelectCard('Please help me conduct UX Research and break down the tasks')}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '20px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '120px'
        }}
        className="suggested-card"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
          <Compass size={17} style={{ color: 'var(--text-subtle)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Suggested Task</span>
        </div>

        <div style={{ marginTop: '14px' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Conduct UX Research
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '4px' }}>
            Usability audits & user flow analysis
          </p>
        </div>
      </div>

      <style>{`
        .suggested-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          border-color: var(--border-focus);
        }
      `}</style>
    </div>
  );
}
