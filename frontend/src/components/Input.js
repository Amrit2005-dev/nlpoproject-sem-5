import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function Input({
  label,
  type = 'text',
  error,
  icon: Icon,
  placeholder,
  value,
  onChange,
  className = '',
  required = false,
  autoComplete,
  id,
  name,
  disabled = false,
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }} className={className}>
      {label && (
        <label
          htmlFor={id || name}
          style={{
            fontSize: '13.5px',
            fontWeight: 600,
            color: 'var(--text-secondary)'
          }}
        >
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-card)',
          border: `1px solid ${error ? '#ef4444' : 'var(--border-color)'}`,
          borderRadius: '10px',
          padding: '0 12px',
          transition: 'border-color 0.18s, box-shadow 0.18s',
          position: 'relative'
        }}
      >
        {Icon && (
          <span style={{ color: 'var(--text-subtle)', marginRight: '8px', display: 'flex', alignItems: 'center' }}>
            <Icon size={18} />
          </span>
        )}

        <input
          id={id || name}
          name={name}
          type={effectiveType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          autoComplete={autoComplete}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: '11px 0',
            fontSize: '14.5px',
            color: 'var(--text-primary)',
            width: '100%'
          }}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(prev => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              marginLeft: '6px'
            }}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      {error && (
        <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '2px' }}>
          {error}
        </span>
      )}
    </div>
  );
}
