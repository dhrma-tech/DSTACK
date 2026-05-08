'use client';

interface SkillCompleteCardProps {
  skillName: string;
  verdict: 'FAIL' | 'REVISE';
  durationMs?: number;
  onRunSuggested?: (skillName: string) => void;
}

const SUGGESTED: Record<string, string> = {
  FAIL: 'investigate',
  REVISE: 'plan-tune',
};

export default function SkillCompleteCard({ skillName, verdict, durationMs, onRunSuggested }: SkillCompleteCardProps) {
  const isFail = verdict === 'FAIL';
  const suggested = SUGGESTED[verdict];

  return (
    <div style={{
      background: isFail ? '#fdecea' : '#fff8e8',
      border: `1px solid ${isFail ? '#f0b0b0' : '#e8c97a'}`,
      borderLeft: `3px solid ${isFail ? 'var(--error)' : 'var(--warning)'}`,
      borderRadius: 10,
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500,
          color: isFail ? 'var(--error)' : 'var(--warning)',
        }}>
          {verdict}
        </span>
        <span style={{ fontSize: 13, color: 'var(--body)' }}>
          /{skillName} completed{durationMs ? ` in ${(durationMs / 1000).toFixed(1)}s` : ''}
        </span>
      </div>

      {suggested && (
        <button
          onClick={() => onRunSuggested?.(suggested)}
          style={{
            background: 'none',
            border: `1px solid ${isFail ? 'var(--error)' : 'var(--warning)'}`,
            color: isFail ? 'var(--error)' : 'var(--warning)',
            borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontWeight: 500,
          }}
        >
          Run /{suggested} →
        </button>
      )}
    </div>
  );
}
