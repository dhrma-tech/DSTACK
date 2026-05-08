'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import Badge from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';
import { useApp } from '@/lib/app-context';
import type { SkillRun } from '@/lib/mock-data';

export default function RunsPage() {
  const { runs } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = runs.find(r => r.id === selectedId) as SkillRun | undefined ?? null;

  return (
    <AppShell>
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* Left list */}
        <div style={{ width: 360, flexShrink: 0, borderRight: '1px solid var(--hairline)', overflowY: 'auto', background: '#fff' }}>
          <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid var(--hairline)' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>Run History</h1>
          </div>
          {runs.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              No runs yet.
            </div>
          )}
          {(runs as SkillRun[]).map(run => (
            <div
              key={run.id}
              onClick={() => setSelectedId(run.id)}
              style={{
                padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--hairline)',
                background: selectedId === run.id ? 'var(--coral-bg)' : '#fff',
                borderLeft: selectedId === run.id ? '2px solid var(--coral)' : '2px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--ink)', flex: 1 }}>
                  /{run.skillName}
                </span>
                {run.verdict && <Badge variant={run.verdict as BadgeVariant}>{run.verdict}</Badge>}
                {run.fakeMode && <Badge variant="FAKE">FAKE</Badge>}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                <span>{new Date(run.requestedAt).toLocaleString()}</span>
                <span>{run.duration}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Right detail */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--canvas)', padding: 24 }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>Select a run to view details</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--coral)' }}>
                  /{selected.skillName}
                </h2>
                {selected.verdict && <Badge variant={selected.verdict as BadgeVariant}>{selected.verdict}</Badge>}
                {selected.fakeMode && <Badge variant="FAKE">FAKE</Badge>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Duration', value: selected.duration },
                  { label: 'Provider', value: selected.provider },
                  { label: 'Model',    value: selected.model },
                  { label: 'Dry Run', value: selected.dryRun ? 'Yes' : 'No' },
                  { label: 'Status',  value: selected.status },
                  { label: 'Run ID',  value: selected.id },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)' }}>{value}</div>
                  </div>
                ))}
              </div>
              {selected.warnings.length > 0 && (
                <div style={{ background: '#fff8e8', border: '1px solid #e8c97a', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#7d5200', marginBottom: 6 }}>Warnings</div>
                  {selected.warnings.map((w, i) => (
                    <p key={i} style={{ fontSize: 13, color: '#7d5200', marginTop: 2 }}>• {w}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
