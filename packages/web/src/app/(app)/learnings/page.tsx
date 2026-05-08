'use client';

import { useEffect, useState, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { api, type LearningEntry } from '@/lib/api';

export default function LearningsPage() {
  const [learnings, setLearnings] = useState<LearningEntry[]>([]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback((q?: string) => {
    api.getLearnings(q).then(setLearnings).catch(() => null);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(query || undefined), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  const handleDelete = async (id: string) => {
    await api.deleteLearning(id).catch(() => null);
    setLearnings(prev => prev.filter(l => l.id !== id));
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <AppShell>
      <div style={{ height: '100%', overflowY: 'auto', padding: 24, background: 'var(--canvas)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, flex: 1 }}>Learnings</h1>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 20, position: 'relative' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search learnings…"
            style={{ width: '100%', maxWidth: 480, padding: '8px 12px 8px 32px', border: '1px solid var(--hairline)', borderRadius: 8, fontSize: 13, outline: 'none' }}
          />
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 14 }}>🔍</span>
        </div>

        {/* Table */}
        {learnings.length === 0 && (
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>No learnings stored. Use <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--coral)' }}>/learn</span> to add insights.</p>
        )}

        <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, overflow: 'hidden', maxWidth: 900 }}>
          {learnings.map((l, i) => (
            <div key={l.id} style={{ borderBottom: i < learnings.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
              <div
                onClick={() => toggleExpand(l.id)}
                style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 2 }}>{l.topic}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.insight.slice(0, 80)}{l.insight.length > 80 ? '…' : ''}
                  </div>
                </div>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'var(--surface-card)', color: 'var(--muted)', border: '1px solid var(--hairline)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                  {l.source}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
                  {new Date(l.createdAt).toLocaleDateString()}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(l.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-soft)', fontSize: 16, padding: '0 4px', flexShrink: 0 }}
                >
                  ×
                </button>
              </div>
              {expanded.has(l.id) && (
                <div style={{ padding: '0 16px 12px', fontSize: 13, color: 'var(--body)', lineHeight: 1.6 }}>
                  {l.insight}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
