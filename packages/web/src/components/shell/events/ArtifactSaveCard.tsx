'use client';

import Badge from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';

interface ArtifactSaveCardProps {
  skillName: string;
  verdict?: string | null;
  path?: string;
  timestamp?: string;
  onView?: (skillName: string) => void;
}

export default function ArtifactSaveCard({ skillName, verdict, timestamp, onView }: ArtifactSaveCardProps) {
  const badgeVariant = (verdict === 'PASS' ? 'PASS' : verdict === 'FAIL' ? 'FAIL' : verdict === 'REVISE' ? 'REVISE' : 'neutral') as BadgeVariant;

  return (
    <div style={{
      height: 48, background: '#ffffff',
      border: '1px solid var(--hairline)', borderLeft: '3px solid var(--success)',
      borderRadius: 10, display: 'flex', alignItems: 'center',
      padding: '0 14px', gap: 8,
    }}>
      {/* Checkmark */}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="var(--success)" strokeWidth="1.5" />
        <path d="M4.5 7L6.5 9L9.5 5" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>

      <span style={{ fontSize: 13, color: 'var(--muted)' }}>Artifact saved:</span>

      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--coral)' }}>
        /{skillName}
      </span>

      {verdict && <Badge variant={badgeVariant}>{verdict}</Badge>}

      {timestamp && (
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
          {new Date(timestamp).toLocaleTimeString()}
        </span>
      )}

      {onView && (
        <button
          onClick={() => onView(skillName)}
          style={{
            marginLeft: timestamp ? 0 : 'auto',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--coral)', fontSize: 12, fontWeight: 500, padding: '2px 0',
          }}
        >
          View →
        </button>
      )}
    </div>
  );
}
