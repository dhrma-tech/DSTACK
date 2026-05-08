'use client';

interface UserCommandCardProps {
  skillName: string;
  flags?: string;
  timestamp?: string;
  model?: string;
}

export default function UserCommandCard({ skillName, flags, timestamp, model }: UserCommandCardProps) {
  return (
    <div style={{
      background: 'var(--surface-dark)',
      borderRadius: 10,
      padding: '12px 16px',
      borderLeft: '3px solid var(--coral)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--coral)', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 400, lineHeight: 1 }}>&gt;</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: 'var(--on-dark)' }}>
          /{skillName}
        </span>
        {flags && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--on-dark-soft)' }}>{flags}</span>
        )}
      </div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
        {timestamp && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-dark-soft)' }}>{timestamp}</span>
        )}
        {model && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'var(--surface-dark-elevated)', color: 'var(--on-dark-soft)', border: '1px solid #333' }}>
            {model}
          </span>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-dark-soft)' }}>triggered by user</span>
      </div>
    </div>
  );
}
