import React from 'react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  isLoading = false,
  disabled = false,
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    borderRadius: '10px',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    transition: 'all 0.18s ease',
    border: 'none',
    outline: 'none',
    position: 'relative',
    gap: '8px',
    opacity: disabled ? 0.6 : 1,
    whiteSpace: 'nowrap'
  };

  const sizes = {
    sm: { padding: '6px 12px', fontSize: '13px' },
    md: { padding: '9px 16px', fontSize: '14px' },
    lg: { padding: '12px 20px', fontSize: '15.5px' },
    icon: { padding: '8px', borderRadius: '8px', width: '36px', height: '36px' }
  };

  const variants = {
    primary: {
      backgroundColor: 'var(--accent-primary)',
      color: '#ffffff',
      boxShadow: 'var(--shadow-sm)',
    },
    secondary: {
      backgroundColor: 'var(--badge-bg)',
      color: 'var(--text-primary)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--text-secondary)',
    },
    outline: {
      backgroundColor: 'transparent',
      border: '1px solid var(--border-color)',
      color: 'var(--text-primary)',
    },
    danger: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      color: '#ef4444',
      border: '1px solid rgba(239, 68, 68, 0.25)',
    }
  };

  const combinedStyles = {
    ...baseStyles,
    ...(sizes[size] || sizes.md),
    ...(variants[variant] || variants.primary)
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      style={combinedStyles}
      className={`btn-component ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="spinner" style={{ width: '16px', height: '16px' }} />
      ) : (
        <>
          {Icon && <Icon size={size === 'sm' ? 14 : 17} />}
          {children}
          {IconRight && <IconRight size={size === 'sm' ? 14 : 17} />}
        </>
      )}
    </button>
  );
}
