import React, { useState } from 'react';
import { Copy, Check, Sparkles, User } from 'lucide-react';
import { formatTimestamp } from '../utils/formatters';

export default function MessageBubble({ message, isAssistant, userAvatar }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (message?.text) {
      navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Helper to format basic markdown (bold, headers, bullets, code)
  const renderFormattedText = (content) => {
    if (!content) return null;
    const lines = content.split('\n');

    return lines.map((line, idx) => {
      // Heading 3
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} style={{ fontSize: '15px', fontWeight: 700, margin: '8px 0 4px 0', color: 'inherit' }}>
            {line.replace('### ', '')}
          </h4>
        );
      }
      // Heading 4
      if (line.startsWith('#### ')) {
        return (
          <h5 key={idx} style={{ fontSize: '14px', fontWeight: 600, margin: '6px 0 2px 0', color: 'inherit' }}>
            {line.replace('#### ', '')}
          </h5>
        );
      }
      // Bullet point
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={idx} style={{ marginLeft: '18px', marginBottom: '3px' }}>
            {formatInlineText(line.substring(2))}
          </li>
        );
      }
      // Numbered point
      if (/^\d+\.\s/.test(line)) {
        return (
          <div key={idx} style={{ marginLeft: '8px', marginBottom: '4px' }}>
            {formatInlineText(line)}
          </div>
        );
      }
      // Empty line
      if (line.trim() === '') {
        return <div key={idx} style={{ height: '6px' }} />;
      }
      // Standard paragraph
      return (
        <p key={idx} style={{ marginBottom: '4px', lineHeight: 1.55 }}>
          {formatInlineText(line)}
        </p>
      );
    });
  };

  // Helper for inline bold, italic, code
  const formatInlineText = (text) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            style={{
              backgroundColor: 'var(--badge-bg)',
              padding: '2px 5px',
              borderRadius: '4px',
              fontSize: '12.5px',
              fontFamily: 'monospace'
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isAssistant ? 'row' : 'row-reverse',
        gap: '12px',
        alignItems: 'flex-start',
        marginBottom: '18px',
        maxWidth: '820px',
        margin: '0 auto 18px auto',
        width: '100%'
      }}
      className="animate-fade-in"
    >
      {/* Avatar Icon */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isAssistant ? 'var(--accent-sparkle-bg)' : 'var(--accent-primary)',
          color: isAssistant ? 'var(--accent-sparkle)' : '#ffffff',
          flexShrink: 0,
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {isAssistant ? (
          <Sparkles size={16} />
        ) : userAvatar ? (
          <img
            src={userAvatar}
            alt="User"
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <User size={16} />
        )}
      </div>

      {/* Bubble Content */}
      <div
        style={{
          maxWidth: '78%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isAssistant ? 'flex-start' : 'flex-end'
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderRadius: isAssistant ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
            backgroundColor: isAssistant ? 'var(--ai-bubble-bg)' : 'var(--user-bubble-bg)',
            color: isAssistant ? 'var(--ai-bubble-text)' : 'var(--user-bubble-text)',
            border: isAssistant ? '1px solid var(--ai-bubble-border)' : 'none',
            boxShadow: 'var(--shadow-sm)',
            fontSize: '14.5px',
            position: 'relative',
            wordBreak: 'break-word'
          }}
        >
          {renderFormattedText(message.text)}
        </div>

        {/* Message Footer: Timestamp & Copy */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '4px',
            padding: '0 4px',
            fontSize: '11px',
            color: 'var(--text-subtle)'
          }}
        >
          <span>{formatTimestamp(message.timestamp)}</span>

          {isAssistant && (
            <button
              onClick={handleCopy}
              title="Copy message"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                background: 'none',
                border: 'none',
                color: 'var(--text-subtle)',
                cursor: 'pointer',
                fontSize: '11px',
                padding: '2px 4px',
                borderRadius: '4px',
                transition: 'color 0.15s'
              }}
            >
              {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
