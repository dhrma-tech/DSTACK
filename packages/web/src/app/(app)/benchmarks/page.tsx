'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import EmptyState from '@/components/EmptyState';
import { useApp } from '@/lib/app-context';
import { BarChart3, Clock, Zap, DollarSign } from 'lucide-react';

export default function BenchmarksPage() {
  const { benchmarkRuns } = useApp();

  return (
    <AppShell breadcrumbs={[{ label: 'Benchmarks' }]}>
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontFamily: 'var(--font-serif)', marginBottom: 4 }}>Benchmarks</h1>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>
            Compare model performance across prompt suites and cost estimates.
          </p>
        </div>

        {benchmarkRuns.length === 0 ? (
          <EmptyState
            icon={<BarChart3 size={48} strokeWidth={1} />}
            title="No benchmarks run"
            description="Use the CLI to run your first benchmark: pnpm ds -- /benchmark"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {benchmarkRuns.map(run => (
              <div key={run.id} className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontFamily: 'var(--font-serif)', marginBottom: 4 }}>{run.suite}</h2>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> Run on {new Date(run.date).toLocaleString()}
                    </div>
                  </div>
                  <div className="badge badge-primary">Multi-Model Compare</div>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-soft)', borderRadius: 'var(--radius-md)' }}>
                  <table className="table" style={{ borderBottom: 'none' }}>
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Quality Score</th>
                        <th>Avg Latency</th>
                        <th>Estimated Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.results.map(res => (
                        <tr key={res.model}>
                          <td style={{ fontWeight: 600 }}>{res.model}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 4, backgroundColor: 'var(--color-surface-soft)', borderRadius: 2, minWidth: 60 }}>
                                <div style={{ height: '100%', width: `${res.quality}%`, backgroundColor: res.quality > 90 ? 'var(--color-success)' : 'var(--color-primary)', borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700 }}>{res.quality}%</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                              <Zap size={10} style={{ color: 'var(--color-warning)' }} />
                              {res.latency}ms
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                              <DollarSign size={10} />
                              {res.cost.toFixed(4)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
