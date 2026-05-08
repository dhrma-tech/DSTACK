'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api, type WorkflowGraph } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';

function nodeColor(status: string) {
  switch (status) {
    case 'PASS': case 'complete': return { bg: '#edf7ee', border: '#b2d9b5', text: '#2e7d32' };
    case 'REVISE':               return { bg: '#fff8e8', border: '#e8c97a', text: '#7d5200' };
    case 'FAIL':                  return { bg: '#fdecea', border: '#f0b0b0', text: 'var(--error)' };
    case 'running':               return { bg: 'var(--coral-bg)', border: 'var(--coral)', text: 'var(--coral)' };
    case 'ready':                 return { bg: '#f0f5ff', border: '#a3b8f0', text: '#1a3a8f' };
    case 'BLOCKED':               return { bg: 'var(--canvas)', border: 'var(--hairline)', text: 'var(--muted)' };
    default:                      return { bg: 'var(--canvas)', border: 'var(--hairline)', text: 'var(--muted)' };
  }
}

export default function WorkflowPage() {
  const [graph, setGraph] = useState<WorkflowGraph | null>(null);
  const [selected, setSelected] = useState<WorkflowGraph['nodes'][0] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getWorkflowGraph().then(setGraph).catch(() => null).finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div style={{ height: '100%', overflowY: 'auto', padding: 24, background: 'var(--canvas)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, marginBottom: 24 }}>Workflow</h1>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton skeleton-block" />)}
          </div>
        )}

        {!loading && !graph && (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No workflow graph available. Connect the backend.</p>
        )}

        {/* Suggested Next */}
        {graph?.suggestedNextSkills && graph.suggestedNextSkills.length > 0 && (
          <div style={{ marginTop: 24, padding: 16, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-primary-soft)', border: '1px solid rgba(230,126,90,0.15)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase' }}>Suggested next: </span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{graph.suggestedNextSkills.join(', ')}</span>
          </div>
        )}

        {graph && (
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginTop: 24 }}>
            <div style={{ flex: 1, maxWidth: 560 }}>
              {graph.nodes.map((node, i) => {
                const { bg, border, text } = nodeColor(node.status);
                return (
                  <div key={node.id}>
                    {i > 0 && <div style={{ width: 1, height: 20, background: 'var(--hairline)', margin: '0 auto', marginLeft: 24 }} />}
                    <div
                      onClick={() => setSelected(node === selected ? null : node)}
                      style={{
                        height: 56, borderRadius: 10, border: `1px solid ${border}`,
                        background: bg, cursor: 'pointer', padding: '0 16px',
                        display: 'flex', alignItems: 'center', gap: 10,
                        boxShadow: node === selected ? '0 0 0 2px var(--coral)' : 'none',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: text, flex: 1 }}>
                        /{node.skillName ?? node.id}
                      </span>
                      {node.verdict && <Badge variant={node.verdict as BadgeVariant}>{node.verdict}</Badge>}
                      <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                        {node.phase}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {selected && (
              <div style={{ width: 320, background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, padding: 20 }}>
                <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: 'var(--coral)', marginBottom: 8 }}>
                  /{selected.skillName ?? selected.id}
                </h2>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Phase: {selected.phase}</div>
                {selected.verdict && <Badge variant={selected.verdict as BadgeVariant}>{selected.verdict}</Badge>}
                {selected.timestamp && (
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                    Last run: {new Date(selected.timestamp).toLocaleString()}
                  </p>
                )}
                {selected.isStale && (
                  <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 8 }}>⚠ Artifact is stale</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
