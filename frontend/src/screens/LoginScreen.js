import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Mail, Lock, User, Sun, Moon, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import Input from '../components/Input';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

export default function LoginScreen() {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const { login, signup, demoLogin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (isSignup && !name.trim()) {
      newErrors.name = 'Full name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (isSignup && password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (isSignup) {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setServerError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = async () => {
    setServerError('');
    setSubmitting(true);
    try {
      await demoLogin();
      navigate('/');
    } catch (err) {
      setServerError(err.message || 'Demo login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative'
      }}
    >
      {/* Top Bar with Theme Toggle */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <button
          onClick={toggleTheme}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            color: isDark ? '#fbbf24' : '#6366f1',
            cursor: 'pointer',
            transition: 'all 0.18s'
          }}
        >
          {isDark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </div>

      {/* Main Auth Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          padding: '36px 32px',
          boxShadow: 'var(--shadow-lg)'
        }}
        className="animate-fade-in"
      >
        {/* Brand / Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Sparkles size={24} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {isSignup ? 'Create an account' : 'Welcome back'}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '6px' }}>
            {isSignup
              ? 'Sign up to start organizing chats and tasks'
              : 'Sign in to access your AI workspace & chats'}
          </p>
        </div>

        {/* Demo Credentials Banner */}
        <div
          style={{
            backgroundColor: 'var(--accent-sparkle-bg)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-sparkle)', fontWeight: 700, fontSize: '13px' }}>
              <Zap size={14} />
              <span>Demo Access</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              sarvatha@example.com / password123
            </p>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={handleDemoSignIn}
            isLoading={submitting}
            style={{
              backgroundColor: 'var(--accent-sparkle)',
              fontSize: '12px',
              padding: '6px 12px',
              borderRadius: '8px'
            }}
          >
            Instant Demo
          </Button>
        </div>

        {/* Server Error Message */}
        {serverError && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#ef4444',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '13px',
              marginBottom: '18px'
            }}
          >
            {serverError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isSignup && (
            <Input
              label="Full Name"
              type="text"
              placeholder="e.g. Sarvatha"
              icon={User}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              required
            />
          )}

          <Input
            label="Email Address"
            type="email"
            placeholder="name@company.com"
            icon={Mail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="At least 6 characters"
            icon={Lock}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            required
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />

          {isSignup && (
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Repeat your password"
              icon={Lock}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              required
              autoComplete="new-password"
            />
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={submitting}
            iconRight={ArrowRight}
            style={{ width: '100%', marginTop: '6px' }}
          >
            {isSignup ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        {/* Switch Between Login / Signup */}
        <div style={{ textAlign: 'center', marginTop: '22px' }}>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)' }}>
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setErrors({});
                setServerError('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0
              }}
            >
              {isSignup ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
