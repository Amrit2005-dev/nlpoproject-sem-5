import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Sparkles, Folder } from 'lucide-react';
import { api } from '../services/api';

export default function SavedFilesModal({ isOpen, onClose, onAskAboutFile }) {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    if (isOpen) {
      api.getFiles().then(data => setFiles(data || [])).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: 'var(--shadow-lg)'
        }}
        className="animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent-light)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Folder size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Saved Files</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Files referenced in your workspace sessions</p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-subtle)',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
          {files.map(file => (
            <div
              key={file.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileText size={20} style={{ color: 'var(--accent-primary)' }} />
                <div>
                  <h4 style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</h4>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                    {file.size} • Updated {file.updatedAt}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  onClose();
                  if (onAskAboutFile) onAskAboutFile(`Can you analyze the document "${file.name}"?`);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--accent-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Sparkles size={13} />
                <span>Ask AI</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
