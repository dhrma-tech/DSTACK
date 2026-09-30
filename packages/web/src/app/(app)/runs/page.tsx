'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Badge from '@/components/ui/Badge';
import { useApp } from '@/lib/app-context';

export default function RunsPage() {
  const { runs, isLoading, loadError } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = runs.find(r => r.id === selectedId) ?? null;

  return (
    <AppShell>
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <div style={{ width: 360, flexShrink: 0, borderRight: '1px solid var(--hairline)', overflowY: 'auto', background: '#fff' }}>
          <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid var(--hairline)' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>Run History</h1>
          </div>
          {loadError && (
            <div role="alert" style={{ padding: 16, fontSize: 13, color: 'var(--error)' }}>{loadError}</div>
          )}
          {isLoading && [1, 2, 3].map(i => <div key={i} className="skeleton skeleton-block" style={{ height: 48, margin: '8px 16px' }} />)}
          {!isLoading && !loadError && runs.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              No runs yet. Start one from the <Link href="/workspace" style={{ color: 'var(--coral)' }}>workspace</Link>, beginning with /office-hours.
            </div>
          )}
          {runs.map(run => (
            <button
              key={run.id}
              onClick={() => setSelectedId(run.id)}
              aria-pressed={selectedId === run.id}
              style={{
                display: 'block', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--hairline)',
                padding: '10px 16px', cursor: 'pointer',
                background: selectedId === run.id ? 'var(--coral-bg)' : '#fff',
                borderLeft: selectedId === run.id ? '2px solid var(--coral)' : '2px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--ink)', flex: 1 }}>/{run.skillName}</span>
                {run.verdict && <Badge variant={run.verdict}>{run.verdict}</Badge>}
                {run.status === 'running' && <Badge variant="RUNNING">RUNNING</Badge>}
                {run.fakeMode && <Badge variant="FAKE">FAKE</Badge>}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                <span>{new Date(run.startedAt).toLocaleString()}</span>
                <span>{run.duration}</span>
                <span>{run.source === 'cli' ? 'CLI' : 'Web'}</span>
              </div>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--canvas)', padding: 24 }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>Select a run to see its details</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--coral)' }}>/{selected.skillName}</h2>
                {selected.verdict && <Badge variant={selected.verdict}>{selected.verdict}</Badge>}
                {selected.fakeMode && <Badge variant="FAKE">FAKE</Badge>}
                {selected.source === 'web' && (
                  <Link href={`/runs/${encodeURIComponent(selected.id)}`} style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--coral)' }}>Open run →</Link>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Duration', value: selected.duration },
                  { label: 'Provider', value: selected.provider },
                  { label: 'Started from', value: selected.source === 'cli' ? 'ds CLI' : 'Web' },
                  { label: 'Tool calls', value: String(selected.toolCallCount) },
                  { label: 'Status', value: selected.status },
                  { label: 'Run ID', value: selected.id },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 8, padding: 12, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{value}</div>
                  </div>
                ))}
              </div>
              {selected.source === 'cli' && (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>This run was started from the ds CLI, so only its summary is available here. The full log is in .dstack/logs.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
