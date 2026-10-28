/**
 * SUGGESTED CARDS TEMPLATE
 * Matches the 3 cards in Image 2 Layout Reference:
 * 1. Previously viewed files
 * 2. Summarize your last meeting (UX Strategy Meet up, 1 Apr 2025, 14:00 pm, avatar)
 * 3. Suggested Task (Conduct UX Research)
 */

import React from 'react';
import { FileText, Sparkles, Compass } from 'lucide-react';

export default function SuggestedCardsTemplate({ onSelectPrompt }) {
  return (
    <div className="suggested-cards-grid">
      {/* Card 1: Previously viewed files */}
      <div
        className="suggested-card"
        onClick={() => onSelectPrompt && onSelectPrompt('View my previously indexed documents')}
      >
        <div className="card-top-label">
          <FileText size={18} style={{ color: 'var(--text-subtle)' }} />
          <span>Previously viewed files</span>
        </div>
        <div className="card-bottom-content">
          <p className="card-bottom-sub">UX_Strategy_Brief_2026.pdf • IndicRAG_Summary.json</p>
        </div>
      </div>

      {/* Card 2: Summarize your last meeting */}
      <div
        className="suggested-card"
        onClick={() => onSelectPrompt && onSelectPrompt('Can you summarize my last meeting (UX Strategy Meet up)?')}
      >
        <div className="card-top-label sparkle">
          <Sparkles size={16} />
          <span>Summarize your last meeting</span>
        </div>

        <div className="card-bottom-content" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="meeting-avatar-wrap">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"
              alt="avatar"
            />
            <span className="status-dot"></span>
          </div>
          <div>
            <h4 className="card-bottom-title">UX Strategy Meet up</h4>
            <p className="card-bottom-sub">1 Apr 2025, 14:00 pm</p>
          </div>
        </div>
      </div>

      {/* Card 3: Suggested Task */}
      <div
        className="suggested-card"
        onClick={() => onSelectPrompt && onSelectPrompt('Please help me conduct UX Research and break down the tasks')}
      >
        <div className="card-top-label">
          <Compass size={17} style={{ color: 'var(--text-subtle)' }} />
          <span>Suggested Task</span>
        </div>

        <div className="card-bottom-content">
          <h4 className="card-bottom-title">Conduct UX Research</h4>
          <p className="card-bottom-sub">Usability audits & user flow analysis</p>
        </div>
      </div>
    </div>
  );
}
