'use client';

import React from 'react';

export type BadgeVariant =
  | 'PASS' | 'FAIL' | 'REVISE' | 'RUNNING' | 'BLOCKED' | 'FAKE'
  | 'ALLOW' | 'REQUIRE_APPROVAL' | 'DENY'
  | 'NORMAL' | 'CAREFUL' | 'GUARD'
  | 'success' | 'error' | 'warning' | 'neutral' | 'info' | 'coral';

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  PASS:             { bg: '#edf7ee',          color: '#2e7d32',  border: '#b2d9b5' },
  FAIL:             { bg: '#fdecea',          color: '#c64545',  border: '#f0b0b0' },
  REVISE:           { bg: '#fff8e8',          color: '#7d5200',  border: '#e8c97a' },
  RUNNING:          { bg: 'var(--coral-bg)',  color: 'var(--coral)', border: '#f0c4b3' },
  BLOCKED:          { bg: 'var(--canvas)',    color: 'var(--muted)', border: 'var(--hairline)' },
  FAKE:             { bg: '#fff8e8',          color: '#7d5200',  border: '#e8c97a' },
  ALLOW:            { bg: '#edf7ee',          color: '#2e7d32',  border: '#b2d9b5' },
  REQUIRE_APPROVAL: { bg: '#fff8e8',          color: '#7d5200',  border: '#e8c97a' },
  DENY:             { bg: '#fdecea',          color: '#c64545',  border: '#f0b0b0' },
  NORMAL:           { bg: 'var(--canvas)',    color: 'var(--muted)', border: 'var(--hairline)' },
  CAREFUL:          { bg: '#fff8e8',          color: '#7d5200',  border: '#e8c97a' },
  GUARD:            { bg: '#fdecea',          color: '#c64545',  border: '#f0b0b0' },
  success:          { bg: '#edf7ee',          color: '#2e7d32',  border: '#b2d9b5' },
  error:            { bg: '#fdecea',          color: '#c64545',  border: '#f0b0b0' },
  warning:          { bg: '#fff8e8',          color: '#7d5200',  border: '#e8c97a' },
  neutral:          { bg: 'var(--canvas)',    color: 'var(--muted)', border: 'var(--hairline)' },
  info:             { bg: '#f0f5ff',          color: '#1a3a8f',  border: '#a3b8f0' },
  coral:            { bg: 'var(--coral-bg)',  color: 'var(--coral)', border: '#f0c4b3' },
};

interface BadgeProps {
  variant: BadgeVariant;
  children?: React.ReactNode;
  className?: string;
}

export default function Badge({ variant, children, className }: BadgeProps) {
  const styles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.neutral;
  const isRunning = variant === 'RUNNING';
  const isBlocked = variant === 'BLOCKED';

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 9999,
        border: `1px solid ${styles.border}`,
        background: styles.bg,
        color: styles.color,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
      }}
    >
      {isRunning && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--coral)',
          animation: 'pulse 1.5s ease-in-out infinite',
          flexShrink: 0,
        }} />
      )}
      {isBlocked && (
        <span style={{ fontSize: 10, flexShrink: 0 }}>🔒</span>
      )}
      {children ?? variant}
    </span>
  );
}
