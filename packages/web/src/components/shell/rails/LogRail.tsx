'use client';

import { useState } from 'react';
import type { ShellEvent } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';

type FilterType = 'all' | 'tool-call' | 'approval' | 'error' | 'browser';

interface LogRailProps {
  events: ShellEvent[];
}

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'tool-call', label: 'Tool Calls' },
  { id: 'approval', label: 'Approvals' },
  { id: 'error',    label: 'Errors' },
  { id: 'browser',  label: 'Browser' },
];

export default function LogRail({ events }: LogRailProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toolCalls = events
    .map((ev, i) => ({ ev, i }))
    .filter(({ ev }) => ev.type === 'tool-call' || ev.type === 'approval-required' || ev.type === 'error');

  const filtered = toolCalls.filter(({ ev }) => {
    if (filter === 'all') return true;
    if (filter === 'approval') return ev.type === 'approval-required';
    if (filter === 'error') return ev.type === 'error';
    if (filter === 'browser') return ev.type === 'tool-call' && ev.toolName.startsWith('browser');
    if (filter === 'tool-call') return ev.type === 'tool-call';
    return true;
  });

  // pair tool-calls with results
  const results = new Map<string, Extract<ShellEvent, { type: 'tool-result' }>>();
  events.forEach(ev => { if (ev.type === 'tool-result') results.set(ev.toolName, ev); });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 12px', flexWrap: 'wrap', borderBottom: '1px solid var(--hairline)', flexShrink: 0 }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 9999, cursor: 'pointer',
              background: filter === f.id ? 'var(--coral-bg)' : 'var(--canvas)',
              border: `1px solid ${filter === f.id ? 'var(--coral)' : 'var(--hairline)'}`,
              color: filter === f.id ? 'var(--coral)' : 'var(--muted)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Log rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>No entries</div>
        )}
        {filtered.map(({ ev, i }) => {
          const isExpanded = expanded.has(i);
          const toolName = ev.type === 'tool-call' ? ev.toolName : ev.type === 'approval-required' ? ev.toolName : '';
          const result = toolName ? results.get(toolName) : undefined;
          const gate = ev.type === 'tool-call' ? ev.gateDecision : undefined;
          const rowBg = ev.type === 'error' ? '#fdecea' : ev.type === 'approval-required' ? '#fff8e8' : '#fff';
          const offset: string | null = null;

          return (
            <div key={i}>
              <div
                onClick={() => setExpanded(prev => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i); else next.add(i);
                  return next;
                })}
                style={{
                  height: 32, display: 'flex', alignItems: 'center', gap: 8,
                  padding: '0 12px', cursor: 'pointer',
                  background: rowBg, borderBottom: '1px solid var(--hairline)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#f8f7f4'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = rowBg; }}
              >
                {offset && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', width: 40, flexShrink: 0 }}>
                    {offset}
                  </span>
                )}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {toolName || (ev.type === 'error' ? 'error' : '')}
                </span>
                {gate && <Badge variant={gate as BadgeVariant}>{gate}</Badge>}
                {result?.durationMs != null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                    {result.durationMs}ms
                  </span>
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && result && (
                <div style={{ background: 'var(--surface-dark)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-dark-soft)', padding: '8px 12px', borderBottom: '1px solid #2a2825' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>
                    {result.output}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
