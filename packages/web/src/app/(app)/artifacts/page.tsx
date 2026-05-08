'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import Badge from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';
import { useApp } from '@/lib/app-context';
import ArtifactRail from '@/components/shell/rails/ArtifactRail';

export default function ArtifactsPage() {
  const { artifacts } = useApp();
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const latestArtifacts = artifacts.filter(a => a.isLatest);

  return (
    <AppShell>
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--hairline)', overflowY: 'auto', background: 'var(--surface-card)', padding: '12px 0' }}>
          <div style={{ padding: '0 12px 8px', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted-soft)' }}>
            Artifacts
          </div>
          {latestArtifacts.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--muted)', padding: '16px 12px' }}>No artifacts yet.</p>
          )}
          {latestArtifacts.map(art => (
            <div
              key={art.id}
              onClick={() => setSelectedSkill(art.skillName)}
              style={{
                padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                background: selectedSkill === art.skillName ? 'var(--canvas)' : 'transparent',
                borderLeft: selectedSkill === art.skillName ? '2px solid var(--coral)' : '2px solid transparent',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: art.verdict === 'PASS' ? 'var(--success)' : art.verdict === 'FAIL' ? 'var(--error)' : art.verdict === 'REVISE' ? 'var(--warning)' : 'var(--muted-soft)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--body)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                /{art.skillName}
              </span>
              {art.verdict && <Badge variant={art.verdict as BadgeVariant}>{art.verdict}</Badge>}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!selectedSkill ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>Select an artifact to view it</p>
            </div>
          ) : (
            <ArtifactRail selectedSkill={selectedSkill} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
