'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import { useApp } from '@/lib/app-context';
import { type DeployRun } from '@/lib/mock-data';
import { Rocket, Snowflake, ShieldCheck, AlertTriangle, CheckCircle2, History, Clock } from 'lucide-react';

export default function DeployPage() {
  const { deployRuns } = useApp();

  return (
    <AppShell breadcrumbs={[{ label: 'Deploy' }]}>
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontFamily: 'var(--font-serif)', marginBottom: 4 }}>Deploy</h1>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>
            Manage production deployments with safety gates and approval workflows.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          <div>
            {/* Readiness Gate */}
            <div className="card" style={{ marginBottom: 24, padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Deployment Readiness</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'QA Report', passed: false, reason: 'Not yet run — execute qa first' },
                  { label: 'Review Completed', passed: false, reason: 'Not yet run — execute review first' },
                  { label: 'Ship Checklist', passed: false, reason: 'Not yet run — execute ship first' },
                  { label: 'No Stale Artifacts', passed: true, reason: '' },
                ].map(gate => (
                  <div key={gate.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 'var(--radius-md)', backgroundColor: gate.passed ? 'rgba(16,185,129,0.04)' : 'rgba(245,158,11,0.04)', border: `1px solid ${gate.passed ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}` }}>
                    {gate.passed ? <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} /> : <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{gate.label}</div>
                      {gate.reason && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{gate.reason}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Deploy Actions */}
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Deploy Actions</h2>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" disabled title="Complete all readiness gates first">
                  <Rocket size={14} /> Dry Run
                </button>
                <button className="btn btn-danger" disabled title="Complete all readiness gates first">
                  <ShieldCheck size={14} /> Deploy to Production
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 12 }}>
                Production deploys require all gates to pass and a typed confirmation hash.
              </p>
            </div>
          </div>

          {/* History Sidebar */}
          <div>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <History size={12} /> Deploy History
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {deployRuns.map((run: DeployRun) => (
                  <div key={run.id} style={{ paddingBottom: 12, borderBottom: '1px solid var(--color-border-soft)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{run.type}</span>
                      <StatusBadge status={run.status as any} label={run.verdict} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} /> {new Date(run.startedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
