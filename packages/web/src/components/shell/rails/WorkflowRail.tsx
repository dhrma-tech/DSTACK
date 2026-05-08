'use client';

import { useEffect, useState } from 'react';
import { api, type WorkflowGraph } from '@/lib/api';

interface WorkflowRailProps {
  onSelectSkill?: (skillName: string) => void;
}

function nodeColors(status: string) {
  switch (status) {
    case 'PASS':     case 'complete':  return { bg: '#edf7ee', border: '#b2d9b5', text: '#2e7d32' };
    case 'REVISE':                     return { bg: '#fff8e8', border: '#e8c97a', text: '#7d5200' };
    case 'FAIL':                       return { bg: '#fdecea', border: '#f0b0b0', text: 'var(--error)' };
    case 'running':                    return { bg: 'var(--coral-bg)', border: 'var(--coral)', text: 'var(--coral)' };
    case 'ready':                      return { bg: '#f0f5ff', border: '#a3b8f0', text: '#1a3a8f' };
    case 'BLOCKED':                    return { bg: 'var(--canvas)', border: 'var(--hairline)', text: 'var(--muted)' };
    default:                           return { bg: 'var(--canvas)', border: 'var(--hairline)', text: 'var(--muted)' };
  }
}

export default function WorkflowRail({ onSelectSkill }: WorkflowRailProps) {
  const [graph, setGraph] = useState<WorkflowGraph | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const g = await api.getWorkflowGraph();
      setGraph(g);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  // Refresh on SSE events
  useEffect(() => {
    const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001') + '/api';
    const es = new EventSource(`${API_BASE}/events`);
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as { type: string };
        if (ev.type === 'artifact-saved') load();
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, []);

  if (loading) {
    return <div style={{ padding: 16 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} className="skeleton skeleton-block" style={{ marginBottom: 8, height: 44 }} />
      ))}
    </div>;
  }

  if (!graph) {
    return <div style={{ padding: 16, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>No workflow graph</div>;
  }

  const staleCount = graph.nodes.filter(n => n.isStale).length;

  return (
    <div style={{ padding: 12 }}>
      {staleCount > 0 && (
        <div style={{ background: '#fff8e8', border: '1px solid #e8c97a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#7d5200' }}>
          ⚠ {staleCount} artifact{staleCount > 1 ? 's are' : ' is'} stale — re-run affected skills.
        </div>
      )}

      {graph.nodes.map((node, i) => {
        const { bg, border, text } = nodeColors(node.status);
        const isBlocked = node.status === 'BLOCKED';

        return (
          <div key={node.id}>
            {/* Connector line */}
            {i > 0 && (
              <div style={{ width: 1, height: 16, background: nodeColors(graph.nodes[i-1].status).border, margin: '0 auto', marginLeft: 12 }} />
            )}

            <div
              onClick={() => onSelectSkill?.(node.skillName ?? node.id)}
              style={{
                width: '100%', height: 44, borderRadius: 8, padding: '0 12px',
                border: `1px solid ${border}`, background: bg,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                position: 'relative',
              }}
            >
              {isBlocked && (
                <span style={{ fontSize: 10, flexShrink: 0 }}>🔒</span>
              )}
              {node.status === 'running' && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--coral)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
              )}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                /{node.skillName ?? node.label}
              </span>
              {node.verdict && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: text, color: '#fff', flexShrink: 0 }}>
                  {node.verdict}
                </span>
              )}
              {node.isStale && (
                <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', border: '2px solid #fff' }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
