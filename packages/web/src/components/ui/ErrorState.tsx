'use client';

import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  headline?: string;
  description?: string;
  isServerDown?: boolean;
  onRetry?: () => void;
}

export default function ErrorState({
  headline = 'Something went wrong',
  description,
  isServerDown,
  onRetry,
}: ErrorStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, textAlign: 'center', flex: 1 }}>
      <AlertTriangle size={40} style={{ color: 'var(--warning)', marginBottom: 16 }} />
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)', marginBottom: 8 }}>
        {headline}
      </h2>
      {isServerDown ? (
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 12 }}>
          Cannot connect to DStack server. Is it running?{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--surface-card)', padding: '2px 6px', borderRadius: 4 }}>
            pnpm server
          </code>
        </p>
      ) : description ? (
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 12, maxWidth: 360 }}>
          {description}
        </p>
      ) : null}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'var(--coral)', color: '#fff',
            border: 'none', borderRadius: 8, padding: '8px 20px',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
