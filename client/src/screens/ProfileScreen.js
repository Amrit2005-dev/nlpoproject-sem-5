import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Shield, Sparkles, Moon, Sun, CheckCircle, MessageSquare, CheckSquare, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useChat } from '../hooks/useChat';
import Button from '../components/Button';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { allConversations } = useChat();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--bg-app)',
        padding: '30px 20px',
        overflowY: 'auto'
      }}
    >
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          <ArrowLeft size={18} />
          <span>Back to Workspace</span>
        </button>

        {/* Profile Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '32px',
            boxShadow: 'var(--shadow-md)',
            marginBottom: '20px'
          }}
          className="animate-fade-in"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <img
                src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                alt={user?.name || 'User'}
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--accent-light)'
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  width: '16px',
                  height: '16px',
                  backgroundColor: '#10b981',
                  borderRadius: '50%',
                  border: '2px solid var(--bg-card)'
                }}
              />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {user?.name || 'Sarvatha'}
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    backgroundColor: 'var(--accent-sparkle-bg)',
                    color: 'var(--accent-sparkle)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(139, 92, 246, 0.2)'
                  }}
                >
                  Pro Researcher
                </span>
              </div>
              <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {user?.email || 'sarvatha@example.com'}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                NLP IndicRAG-QA & AI Productivity Workspace
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '14px',
              marginTop: '28px',
              paddingTop: '24px',
              borderTop: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'var(--bg-app)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', marginBottom: '6px' }}>
                <MessageSquare size={16} />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Conversations</span>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {allConversations?.length || 1}
              </div>
            </div>

            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'var(--bg-app)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', marginBottom: '6px' }}>
                <CheckSquare size={16} />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Status</span>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Active
              </div>
            </div>

            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'var(--bg-app)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', marginBottom: '6px' }}>
                <Shield size={16} />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Auth Level</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '3px' }}>
                JWT Verified
              </div>
            </div>
          </div>
        </div>

        {/* Preferences & Actions */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Workspace Preferences
          </h3>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-app)'
            }}
          >
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Theme Mode
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                Currently set to {isDark ? 'Dark Theme' : 'Light Theme'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={isDark ? Sun : Moon}
              onClick={toggleTheme}
            >
              Toggle to {isDark ? 'Light' : 'Dark'}
            </Button>
          </div>

          <div style={{ paddingTop: '8px' }}>
            <Button
              variant="danger"
              size="md"
              icon={LogOut}
              onClick={handleLogout}
              style={{ width: '100%' }}
            >
              Sign Out from AI Workspace
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
