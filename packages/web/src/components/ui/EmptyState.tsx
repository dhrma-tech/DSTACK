'use client';

interface EmptyStateProps {
  headline: string;
  description?: string;
  cta?: { label: string; onClick: () => void };
}

export default function EmptyState({ headline, description, cta }: EmptyStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, textAlign: 'center', flex: 1 }}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ marginBottom: 16 }}>
        <path d="M20 3L35 11V29L20 37L5 29V11L20 3Z" stroke="var(--coral)" strokeWidth="2" fill="none"/>
        <path d="M20 10L20 30M14 15L26 25M26 15L14 25" stroke="var(--coral)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, color: 'var(--ink)', marginBottom: 8 }}>
        {headline}
      </h2>
      {description && (
        <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 360, lineHeight: 1.6 }}>
          {description}
        </p>
      )}
      {cta && (
        <button
          onClick={cta.onClick}
          style={{
            marginTop: 20, background: 'var(--coral)', color: '#fff',
            border: 'none', borderRadius: 8, padding: '8px 20px',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}
