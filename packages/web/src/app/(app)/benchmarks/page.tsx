'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api, type BenchmarkRun } from '@/lib/api';

export default function BenchmarksPage() {
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [selected, setSelected] = useState<BenchmarkRun | null>(null);

  useEffect(() => {
    api.getBenchmarks().then(r => { setRuns(r); if (r.length) setSelected(r[0]); }).catch(() => null);
  }, []);

  return (
    <AppShell>
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* Left list */}
        <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--hairline)', overflowY: 'auto', background: '#fff' }}>
          <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid var(--hairline)' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400 }}>Benchmarks</h1>
          </div>
          {runs.length === 0 && (
            <p style={{ padding: 16, fontSize: 13, color: 'var(--muted)' }}>No benchmarks run yet.</p>
          )}
          {runs.map(run => (
            <div
              key={run.id}
              onClick={() => setSelected(run)}
              style={{
                padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--hairline)',
                background: selected?.id === run.id ? 'var(--coral-bg)' : '#fff',
                borderLeft: selected?.id === run.id ? '2px solid var(--coral)' : '2px solid transparent',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{run.suite}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(run.date).toLocaleDateString()}</div>
              {run.fakeMode && (
                <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 9999, background: '#fff8e8', color: '#7d5200', border: '1px solid #e8c97a', fontFamily: 'var(--font-mono)' }}>FAKE</span>
              )}
            </div>
          ))}
        </div>

        {/* Right detail */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--canvas)', padding: 24 }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>Select a benchmark run</p>
            </div>
          ) : (
            <>
              {selected.fakeMode && (
                <div style={{ background: '#fff8e8', border: '1px solid #e8c97a', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: '#7d5200' }}>
                  ⚠ This benchmark ran in FAKE mode — results are not real model performance.
                </div>
              )}
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, marginBottom: 16 }}>{selected.suite}</h2>
              <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--hairline)' }}>
                      {['Model', 'Quality', 'Latency (ms)', 'Tokens'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--muted)', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.results.map(r => (
                      <tr key={r.model} style={{ borderBottom: '1px solid var(--hairline)' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.model}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: r.quality >= 90 ? 'var(--success)' : r.quality >= 70 ? 'var(--warning)' : 'var(--error)' }}>{r.quality}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.latencyMs}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.tokens?.toLocaleString() ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
