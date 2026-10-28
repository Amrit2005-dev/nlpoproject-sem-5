import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, ArrowRight, CornerDownLeft } from 'lucide-react';
import MessageBubble from './MessageBubble';
import SuggestedCards from './SuggestedCards';
import TaskManager from './TaskManager';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../hooks/useAuth';

export default function ChatArea({ onOpenSavedFiles, onTaskCountChange }) {
  const { currentChat, isSending, sendMessage } = useChat();
  const { user } = useAuth();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const hasMessages = currentChat && currentChat.messages && currentChat.messages.length > 0;

  // Auto scroll to bottom of messages
  useEffect(() => {
    if (hasMessages) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentChat?.messages, isSending, hasMessages]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const textToSend = inputText;
    setInputText('');
    await sendMessage(textToSend);
    inputRef.current?.focus();
  };

  const handleSelectCard = (promptText) => {
    setInputText(promptText);
    sendMessage(promptText);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Scrollable Center Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
        }}
        className="chat-scroll-area"
      >
        {!hasMessages ? (
          <div style={{ margin: 'auto 0', paddingBottom: '30px' }} className="animate-fade-in">
            {/* Hero Heading from Image 2 */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1
                style={{
                  fontSize: '32px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                  fontFamily: 'var(--font-family)',
                }}
              >
                How can I help you today?
              </h1>
            </div>

            {/* 3 Suggestion Cards from Image 2 */}
            <SuggestedCards
              onSelectCard={handleSelectCard}
              onOpenSavedFiles={onOpenSavedFiles}
            />

            {/* My Tasks Section from Image 2 */}
            <TaskManager onTaskCountChange={onTaskCountChange} />
          </div>
        ) : (
          <div style={{ maxWidth: '840px', width: '100%', margin: '0 auto', paddingBottom: '16px' }}>
            {/* Conversation Title Bar */}
            <div
              style={{
                textAlign: 'center',
                padding: '8px 0 20px 0',
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: '20px'
              }}
            >
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {currentChat.title}
              </h2>
            </div>

            {/* Message History Thread */}
            {currentChat.messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isAssistant={msg.sender === 'assistant'}
                userAvatar={user?.avatar}
              />
            ))}

            {/* Loading / Typing State */}
            {isSending && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  maxWidth: '820px',
                  margin: '0 auto 16px auto',
                  width: '100%'
                }}
                className="animate-fade-in"
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-sparkle-bg)',
                    color: 'var(--accent-sparkle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <Sparkles size={16} />
                </div>
                <div
                  style={{
                    padding: '12px 18px',
                    borderRadius: '4px 16px 16px 16px',
                    backgroundColor: 'var(--ai-bubble-bg)',
                    border: '1px solid var(--ai-bubble-border)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span className="typing-dot" />
                  <span className="typing-dot" style={{ animationDelay: '0.2s' }} />
                  <span className="typing-dot" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating Bottom Input Bar Matching Image 2 */}
      <div className="bottom-input-container">
        <form onSubmit={handleSend} className="bottom-input-pill">
          <Sparkles
            size={18}
            style={{
              color: 'var(--accent-sparkle)',
              marginLeft: '4px',
              marginRight: '2px',
              flexShrink: 0
            }}
          />

          <input
            ref={inputRef}
            type="text"
            className="bottom-input-field"
            placeholder="Ask or search for anything. Use @ to tag a file or collection."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
          />

          <button
            type="submit"
            className="send-button"
            disabled={!inputText.trim() || isSending}
            title="Send message"
          >
            {isSending ? (
              <span className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }} />
            ) : (
              <ArrowRight size={17} />
            )}
          </button>
        </form>
      </div>

      {/* Typing dots CSS */}
      <style>{`
        .typing-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background-color: var(--accent-sparkle);
          display: inline-block;
          animation: pulseGlow 1.2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
