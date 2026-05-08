'use client';

import React, { useState } from 'react';
import AppShell from '@/components/AppShell';
import StatusBadge from '@/components/StatusBadge';
import CodeWindow from '@/components/CodeWindow';
import { useApp } from '@/lib/app-context';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Clock, Cpu, Database, Layers, Download, RotateCcw, Columns, X } from 'lucide-react';
import Badge from '@/components/ui/Badge';

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.id as string;
  const { runs } = useApp();

  const [compareId, setCompareId] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const run = runs.find(r => r.id === runId);
  const compareWith = runs.find(r => r.id === compareId);

  if (!run) {
    return (
      <AppShell breadcrumbs={[{ label: 'Runs', href: '/runs' }, { label: runId }]}>
        <div style={{ padding: 32, textAlign: 'center' }}>
          <h2 style={{ fontSize: 20, fontFamily: 'var(--font-sans)', marginBottom: 8 }}>Run not found</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>No run with ID &quot;{runId}&quot; exists.</p>
          <Link href="/runs" className="btn btn-secondary">← Back to Runs</Link>
        </div>
      </AppShell>
    );
  }

  const otherRuns = runs.filter(r => r.skillName === run.skillName && r.id !== run.id);

  return (
    <AppShell
      breadcrumbs={[{ label: 'Runs', href: '/runs' }, { label: run.id }]}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setIsComparing(!isComparing)}
            style={{ fontSize: 12, height: 30, padding: '0 12px', border: isComparing ? '1px solid var(--coral)' : undefined, color: isComparing ? 'var(--coral)' : undefined }}
          >
            <Columns size={12} /> {isComparing ? 'Close Comparison' : 'Compare Run'}
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 12, height: 30, padding: '0 12px' }}>
            <RotateCcw size={12} /> Re-run
          </button>
          <button className="btn btn-primary" style={{ fontSize: 12, height: 30, padding: '0 12px' }}>
            <Download size={12} /> Artifacts
          </button>
        </div>
      }
    >
      <div style={{ padding: 32 }}>
        {isComparing && (
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--hairline)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Compare with another /{run.skillName} run</h3>
              <button onClick={() => setIsComparing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
              {otherRuns.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>No other runs of this skill found to compare with.</p>
              ) : (
                otherRuns.map(r => (
                  <div 
                    key={r.id} 
                    onClick={() => setCompareId(r.id)}
                    style={{ 
                      minWidth: 200, padding: 12, background: compareId === r.id ? 'var(--coral-bg)' : '#fff', 
                      border: `1px solid ${compareId === r.id ? 'var(--coral)' : 'var(--hairline)'}`, 
                      borderRadius: 12, cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>Run {r.id.slice(-8)}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{r.model} • {r.duration}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
          <h1 style={{ fontSize: 28, fontFamily: 'var(--font-serif)' }}>Run {run.id}</h1>
          <StatusBadge status={run.status as any} />
          {run.verdict && <Badge variant={run.verdict as any}>{run.verdict}</Badge>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isComparing && compareWith ? '1fr 1fr' : '1fr 280px', gap: 24 }}>
          {/* Main Run */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', background: 'var(--surface-card)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{run.model} (Original)</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{run.duration}</span>
              </div>
              <div style={{ padding: 20 }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Result Artifact</h4>
                <CodeWindow 
                  title="artifact.json"
                  code={`{\n  "status": "PASS",\n  "skill": "${run.skillName}",\n  "model": "${run.model}",\n  "outputs": {\n    "roadmap": "MVP for CounselPro SaaS established with 3 key milestones."\n  }\n}`}
                />
              </div>
            </div>
          </div>

          {/* Comparison Run */}
          {isComparing && compareWith ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', background: 'var(--surface-card)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{compareWith.model} (Comparison)</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{compareWith.duration}</span>
                </div>
                <div style={{ padding: 20 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Result Artifact</h4>
                  <CodeWindow 
                    title="artifact.json"
                    code={`{\n  "status": "PASS",\n  "skill": "${compareWith.skillName}",\n  "model": "${compareWith.model}",\n  "outputs": {\n    "roadmap": "Enhanced roadmap with multi-state support and AI predictor logic."\n  }\n}`}
                  />
                </div>
              </div>
            </div>
          ) : !isComparing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 16, padding: 20 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>Metadata</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { icon: Clock, label: 'Duration', value: run.duration },
                    { icon: Cpu, label: 'Model', value: run.model },
                    { icon: Database, label: 'Provider', value: run.fakeMode ? 'fake' : run.provider },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
