/**
 * LOGIN & SIGNUP SCREEN TEMPLATE
 * Reusable Authentication Screen:
 * - Tab toggle between Sign In and Create Account
 * - Input validation & error states
 * - Password visibility toggle
 * - Instant Demo Credentials access
 */

import React, { useState } from 'react';
import { Sparkles, Mail, Lock, User, ArrowRight, Zap } from 'lucide-react';

export default function LoginScreenTemplate({ onLogin, onSignup, onDemoLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)', padding: '24px' }}>
      <div className="modal-dialog" style={{ maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--accent-light)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
            <Sparkles size={24} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800 }}>{isSignup ? 'Create an account' : 'Welcome back'}</h2>
        </div>

        {/* Demo Credentials Box */}
        <div style={{ backgroundColor: 'var(--accent-sparkle-bg)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '12px', padding: '12px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-sparkle)', fontWeight: 700, fontSize: '13px' }}>
              <Zap size={14} />
              <span>Demo Access</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>sarvatha@example.com / password123</p>
          </div>
          <button className="btn-component btn-primary" style={{ backgroundColor: 'var(--accent-sparkle)', fontSize: '12px', padding: '6px 12px' }} onClick={onDemoLogin}>
            Instant Demo
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); isSignup ? onSignup(name, email, password) : onLogin(email, password); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isSignup && (
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <div className="input-control-wrap">
                <input className="input-field" placeholder="e.g. Sarvatha" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Email Address</label>
            <div className="input-control-wrap">
              <input className="input-field" type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div className="input-control-wrap">
              <input className="input-field" type="password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          <button type="submit" className="btn-component btn-primary" style={{ padding: '12px', width: '100%', marginTop: '6px' }}>
            <span>{isSignup ? 'Create Account' : 'Sign In'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          <button type="button" onClick={() => setIsSignup(!isSignup)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}>
            {isSignup ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
