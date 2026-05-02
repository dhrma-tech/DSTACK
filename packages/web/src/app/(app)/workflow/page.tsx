'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import StatusBadge from '@/components/StatusBadge';
import { useApp } from '@/lib/app-context';
import { CheckCircle2, ChevronRight, Play, Lock } from 'lucide-react';

const STAGE_COLORS: Record<string, string> = {
  planning: 'var(--color-accent-blue)',
  design: 'var(--color-accent-purple)',
  qa: 'var(--color-warning)',
  shipped: 'var(--color-success)',
};

export default function WorkflowPage() {
  const { workflow } = useApp();

  return (
    <AppShell breadcrumbs={[{ label: 'Workflow' }]}>
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontFamily: 'var(--font-serif)', marginBottom: 4 }}>Workflow</h1>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>
            Your skill execution pipeline — see what's done, what's next, and what's blocked.
          </p>
        </div>

        {/* Blockers */}
        {workflow.blockers.length > 0 && (
          <div style={{ marginBottom: 24, padding: 16, borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-warning)', marginBottom: 6, textTransform: 'uppercase' }}>Blockers</div>
            {workflow.blockers.map((b, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>• {b}</div>
            ))}
          </div>
        )}

        {/* Graph Visualization */}
        <div className="card" style={{ padding: 32, overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 'max-content' }}>
            {workflow.nodes.map((node, i) => (
              <React.Fragment key={node.id}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '16px 20px', borderRadius: 'var(--radius-md)',
                  border: `2px solid ${node.status === 'complete' ? 'var(--color-success)' :
                    node.status === 'ready' || node.status === 'running' ? 'var(--color-primary)' :
                      node.status === 'blocked' ? 'var(--color-warning)' : 'var(--color-border)'}`,
                  backgroundColor: node.status === 'complete' ? 'rgba(16,185,129,0.04)' :
                    node.status === 'ready' ? 'rgba(230,126,90,0.04)' : 'var(--color-surface)',
                  minWidth: 140, textAlign: 'center',
                  transition: 'all 0.2s ease', cursor: 'pointer',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {node.status === 'complete' && <CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} />}
                    {node.status === 'running' && <Play size={12} style={{ color: 'var(--color-primary)' }} />}
                    {node.status === 'blocked' && <Lock size={12} style={{ color: 'var(--color-warning)' }} />}
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{node.label}</span>
                  </div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em', color: STAGE_COLORS[node.stage] || 'var(--color-text-muted)' }}>
                    {node.stage}
                  </div>
                  <StatusBadge status={node.status as any} />
                </div>
                {i < workflow.nodes.length - 1 && (
                  <ChevronRight size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Suggested Next */}
        {workflow.suggestedNextSkills.length > 0 && (
          <div style={{ marginTop: 24, padding: 16, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-primary-soft)', border: '1px solid rgba(230,126,90,0.15)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase' }}>Suggested next: </span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{workflow.suggestedNextSkills.map(s => `/${s}`).join(', ')}</span>
          </div>
        )}
      </div>
    </AppShell>
  );
}
