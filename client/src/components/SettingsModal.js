import React from 'react';
import { X, Sun, Moon, Trash2, Shield, Info, Check } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { storage } from '../utils/storage';

export default function SettingsModal({ isOpen, onClose }) {
  const { theme, toggleTheme, isDark } = useTheme();
  const { user } = useAuth();

  if (!isOpen) return null;

  const handleClearData = () => {
    if (window.confirm('Clear cached conversations and local storage?')) {
      storage.clear();
      window.location.reload();
    }
  };

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
          maxWidth: '480px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: 'var(--shadow-lg)'
        }}
        className="animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Workspace Settings
          </h3>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Appearance Section */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Interface Appearance
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => { if (isDark) toggleTheme(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: `2px solid ${!isDark ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  backgroundColor: !isDark ? 'var(--accent-light)' : 'var(--bg-app)',
                  color: !isDark ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sun size={17} />
                  <span>Light Mode</span>
                </div>
                {!isDark && <Check size={16} />}
              </button>

              <button
                type="button"
                onClick={() => { if (!isDark) toggleTheme(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: `2px solid ${isDark ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  backgroundColor: isDark ? 'var(--accent-light)' : 'var(--bg-app)',
                  color: isDark ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Moon size={17} />
                  <span>Dark Mode</span>
                </div>
                {isDark && <Check size={16} />}
              </button>
            </div>
          </div>

          {/* User Session Info */}
          <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={18} style={{ color: 'var(--accent-primary)' }} />
              <div>
                <p style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Signed in as {user?.name || 'Sarvatha'}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                  {user?.email || 'sarvatha@example.com'} • JWT Authenticated
                </p>
              </div>
            </div>
          </div>

          {/* Reset Cache / Data */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Storage & Cache
            </label>
            <div style={{ marginTop: '8px' }}>
              <button
                type="button"
                onClick={handleClearData}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  color: '#ef4444',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={15} />
                <span>Reset Local Cache & Re-seed</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
