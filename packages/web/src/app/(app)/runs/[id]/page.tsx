'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import StatusBadge from '@/components/StatusBadge';
import CodeWindow from '@/components/CodeWindow';
import { useApp } from '@/lib/app-context';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Clock, Cpu, Database, Layers, Download, RotateCcw } from 'lucide-react';

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.id as string;
  const { runs } = useApp();

  const run = runs.find(r => r.id === runId);

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

  return (
    <AppShell
      breadcrumbs={[{ label: 'Runs', href: '/runs' }, { label: run.id }]}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
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
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h1 style={{ fontSize: 28, fontFamily: 'var(--font-serif)' }}>Run {run.id}</h1>
            <StatusBadge status={run.status as any} />
            {run.verdict && <StatusBadge status={run.verdict === 'PASS' ? 'success' : run.verdict === 'FAIL' ? 'error' : 'warning'} label={run.verdict} />}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--color-text-tertiary)' }}>
            <span>Skill: <strong style={{ color: 'var(--color-text-primary)' }}>{run.command}</strong></span>
            <span>Provider: <strong>{run.fakeMode ? 'fake' : run.provider}</strong></span>
            <span>Model: <strong>{run.model}</strong></span>
            <span>Duration: <strong>{run.duration}</strong></span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
          {/* Execution Log */}
          <div>
            <div style={{
              backgroundColor: 'var(--color-surface-soft)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-soft)', overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 16px', borderBottom: '1px solid var(--color-border-soft)',
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600,
                color: 'var(--color-text-secondary)',
              }}>
                <span className="status-dot status-dot-success" /> Execution Log
              </div>
              <div style={{
                padding: 20, fontFamily: 'var(--font-mono)', fontSize: 12,
                lineHeight: 1.9, color: 'var(--color-text-secondary)', maxHeight: 400, overflowY: 'auto',
              }}>
                <div>[09:21:04] <span style={{ color: 'var(--color-accent-blue)' }}>INFO</span>: Initializing DStack Engine v0.8.2...</div>
                <div>[09:21:05] <span style={{ color: 'var(--color-accent-blue)' }}>INFO</span>: Connecting to {run.fakeMode ? 'Fake' : 'Gemini'} provider...</div>
                <div>[09:21:06] <span style={{ color: 'var(--color-success)' }}>OK</span>: Authenticated successfully.</div>
                <div>[09:21:07] <span style={{ color: 'var(--color-accent-blue)' }}>INFO</span>: Loading skill context for {run.command}...</div>
                <div>[09:21:08] <span style={{ color: 'var(--color-accent-blue)' }}>INFO</span>: Context size: 12.4k tokens.</div>
                <div style={{ margin: '8px 0', borderLeft: '2px solid var(--color-primary)', paddingLeft: 12 }}>
                  <div style={{ color: 'var(--color-primary)', fontWeight: 600 }}>[THOUGHT PROCESS]</div>
                  <div>The user wants to build a SaaS for medical college counseling.</div>
                  <div>Step 1: Scrape relevant data from MCC.nic.in</div>
                  <div>Step 2: Compare with previous year cutoffs.</div>
                  <div>Step 3: Synthesize into a roadmap.json artifact.</div>
                </div>
                <div>[09:21:12] <span style={{ color: 'var(--color-accent-teal)' }}>EXEC</span>: Scraping targets... 100% DONE</div>
                <div>[09:21:15] <span style={{ color: 'var(--color-accent-teal)' }}>EXEC</span>: Analyzing competitive landscape...</div>
                <div>[09:21:18] <span style={{ color: 'var(--color-accent-blue)' }}>INFO</span>: 4 distinct competitor patterns identified.</div>
                <div>[09:21:20] <span style={{ color: 'var(--color-accent-teal)' }}>EXEC</span>: Finalizing roadmap artifact...</div>
                {run.status === 'complete' && (
                  <div style={{ color: 'var(--color-success)' }}>[09:21:22] <span>DONE</span>: Run completed in {run.duration}.</div>
                )}
                {run.status === 'error' && (
                  <div style={{ color: 'var(--color-error)' }}>[09:21:07] <span>ERROR</span>: {run.warnings[0] || 'Execution failed'}</div>
                )}
              </div>
            </div>

            {/* Result Artifact */}
            {run.status === 'complete' && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-sans)', marginBottom: 8 }}>Result Artifact</h3>
                <CodeWindow
                  title="roadmap.json"
                  code={`{
  "product": "CounselPro SaaS",
  "vision": "Automated medical admissions counseling",
  "phases": [
    {
      "name": "Phase 1: MVP",
      "milestones": ["Data integration", "Basic predictor"]
    },
    {
      "name": "Phase 2: Scale",
      "milestones": ["Multi-state support", "AI Consultant"]
    }
  ]
}`}
                />
              </div>
            )}

            {/* Warnings */}
            {run.warnings.length > 0 && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-warning)', marginBottom: 4, textTransform: 'uppercase' }}>Warnings</div>
                {run.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>• {w}</div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Metadata */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: 14 }}>Run Info</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { icon: Clock, label: 'Duration', value: run.duration },
                  { icon: Cpu, label: 'Model', value: run.model },
                  { icon: Database, label: 'Provider', value: run.fakeMode ? 'fake' : run.provider },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <item.icon size={14} style={{ color: 'var(--color-text-muted)' }} />
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: 14 }}>Resources</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href="/skills" style={{ fontSize: 12, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={13} /> Open Skill Definition
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
