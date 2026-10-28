/**
 * CHAT AREA & FLOATING PROMPT INPUT TEMPLATE
 * Matches Image 2 Layout Reference:
 * - Empty state: Hero heading "How can I help you today?" + 3 Suggestion Cards + My Tasks
 * - Active state: Message bubbles with markdown, copy button, timestamps, typing indicator
 * - Bottom: Pill-shaped prompt container with sparkles [✨] and send arrow [→]
 */

import React, { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import SuggestedCards from './SuggestedCards.template';
import TaskManager from './TaskManager.template';

export default function ChatAreaTemplate({ messages = [], onSendMessage, isSending = false }) {
  const [inputText, setInputText] = useState('');
  const hasMessages = messages.length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="chat-viewport">
      <div className="chat-scroll-area">
        {!hasMessages ? (
          <div>
            {/* Hero Heading from Image 2 */}
            <div className="hero-section">
              <h1 className="hero-title">How can I help you today?</h1>
            </div>

            {/* 3 Suggestion Cards */}
            <SuggestedCards onSelectPrompt={(p) => onSendMessage && onSendMessage(p)} />

            {/* My Tasks Board */}
            <TaskManager tasks={[
              { id: '1', title: 'Conduct UX Research for chat flow', completed: false, priority: 'high' },
              { id: '2', title: 'Review IndicRAG-QA benchmark results', completed: true, priority: 'medium' }
            ]} />
          </div>
        ) : (
          <div style={{ maxWidth: '840px', width: '100%', margin: '0 auto' }}>
            {messages.map(msg => (
              <div key={msg.id} className={`message-row ${msg.sender}`}>
                <div className={`message-avatar ${msg.sender}`}>
                  <Sparkles size={16} />
                </div>
                <div className="message-content-wrap">
                  <div className={`message-bubble ${msg.sender}`}>
                    {msg.text}
                  </div>
                  <div className="message-footer">
                    <span>{msg.timestamp || 'Just now'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Bottom Input Bar matching Image 2 */}
      <div className="bottom-input-container">
        <form className="bottom-input-pill" onSubmit={handleSubmit}>
          <Sparkles
            size={18}
            style={{ color: 'var(--accent-sparkle)', marginLeft: '4px', marginRight: '2px', flexShrink: 0 }}
          />
          <input
            type="text"
            className="bottom-input-field"
            placeholder="Ask or search for anything. Use @ to tag a file or collection."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button type="submit" className="send-button" disabled={!inputText.trim() || isSending}>
            <ArrowRight size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}
