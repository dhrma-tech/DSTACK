'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Badge from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';
import { api, type HistoryEntry } from '@/lib/api';
import { Search, RotateCcw, Trash2, Clock, Filter } from 'lucide-react';

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<string>('');
  const [daysFilter, setDaysFilter] = useState<number>(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [timelineIndex, setTimelineIndex] = useState(0);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getHistory({
        search: search || undefined,
        verdict: verdictFilter || undefined,
        days: daysFilter || undefined,
        limit: 100,
      });
      setEntries(data.entries);
      setTotal(data.total);
    } catch {
      // Use empty state on error
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, verdictFilter, daysFilter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClear = async () => {
    if (!confirm('Clear all command history? This cannot be undone.')) return;
    await api.clearHistory().catch(() => null);
    loadHistory();
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <AppShell>
      <div style={{ height: '100%', overflowY: 'auto', padding: 24, background: 'var(--canvas)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={24} style={{ color: 'var(--coral)' }} />
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, margin: 0 }}>
              Command History
            </h1>
            <span style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', padding: '2px 8px',
              borderRadius: 9999, background: 'var(--surface-card)', border: '1px solid var(--hairline)',
              color: 'var(--muted)',
            }}>
              {total} total
            </span>
          </div>
          <button onClick={handleClear} className="btn btn-ghost" style={{ fontSize: 12, gap: 4, color: 'var(--error)' }}>
            <Trash2 size={13} /> Clear
          </button>
        </div>
        
        {/* Timeline Replay */}
        <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 16, padding: 20, marginBottom: 24, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <RotateCcw size={16} /> Workflow Timeline Replay
            </h3>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
              {entries.length > 0 ? `Step ${entries.length - timelineIndex} of ${entries.length}` : 'No history'}
            </div>
          </div>
          
          <div style={{ height: 40, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div style={{ height: 4, width: '100%', background: 'var(--hairline)', borderRadius: 2 }} />
            {entries.map((_, i) => (
              <div 
                key={i}
                onClick={() => setTimelineIndex(i)}
                style={{ 
                  position: 'absolute', left: `${(i / (entries.length - 1)) * 100}%`,
                  width: 12, height: 12, borderRadius: '50%', background: timelineIndex === i ? 'var(--coral)' : 'var(--muted-soft)',
                  cursor: 'pointer', transform: 'translateX(-50%)', border: timelineIndex === i ? '3px solid #fff' : 'none',
                  boxShadow: timelineIndex === i ? '0 0 0 1px var(--coral)' : 'none',
                  transition: 'all 0.2s'
                }}
              />
            ))}
          </div>

          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--canvas)', borderRadius: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
            {entries[timelineIndex] && (
              <>
                <Badge variant={entries[timelineIndex].verdict as any}>{entries[timelineIndex].verdict || 'PENDING'}</Badge>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>Executed /{entries[timelineIndex].skillName}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(entries[timelineIndex].startedAt).toLocaleString()}</span>
              </>
            )}
          </div>
        </div>


        {/* Search + Filters */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 16,
          background: '#fff', border: '1px solid var(--hairline)', borderRadius: 10, padding: 12,
        }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
            <Search size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by skill name or command…"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-sans)',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={12} style={{ color: 'var(--muted)' }} />
            {['', 'PASS', 'REVISE', 'FAIL'].map(v => (
              <button
                key={v}
                onClick={() => setVerdictFilter(v)}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
                  background: verdictFilter === v ? 'var(--surface-card)' : 'transparent',
                  border: `1px solid ${verdictFilter === v ? 'var(--hairline)' : 'transparent'}`,
                  color: verdictFilter === v ? 'var(--ink)' : 'var(--muted)',
                  fontFamily: 'var(--font-mono)', fontWeight: 500,
                }}
              >
                {v || 'All'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {[0, 1, 7, 30].map(d => (
              <button
                key={d}
                onClick={() => setDaysFilter(d)}
                style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                  background: daysFilter === d ? 'var(--surface-card)' : 'transparent',
                  border: `1px solid ${daysFilter === d ? 'var(--hairline)' : 'transparent'}`,
                  color: daysFilter === d ? 'var(--ink)' : 'var(--muted)',
                }}
              >
                {d === 0 ? 'All time' : d === 1 ? '24h' : `${d}d`}
              </button>
            ))}
          </div>
        </div>

        {/* Entries list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {loading && entries.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton skeleton-block" style={{ height: 48, marginBottom: 4 }} />
              ))}
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <Clock size={32} style={{ color: 'var(--muted-soft)', marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 4 }}>No history entries found</p>
              <p style={{ fontSize: 12, color: 'var(--muted-soft)' }}>
                {search || verdictFilter ? 'Try adjusting your filters' : 'Run a skill to start building history'}
              </p>
            </div>
          )}

          {entries.map((entry, i) => (
            <div
              key={entry.id}
              style={{
                background: '#fff', border: '1px solid var(--hairline)',
                borderRadius: expandedId === entry.id ? 10 : 8,
                overflow: 'hidden',
                animation: `fadeInUp 0.2s ease-out ${i * 0.02}s both`,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#d4cdc5')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--hairline)')}
            >
              {/* Row */}
              <div
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  cursor: 'pointer', fontSize: 13,
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: entry.verdict === 'PASS' ? 'var(--success)' :
                              entry.verdict === 'FAIL' ? 'var(--error)' :
                              entry.verdict === 'REVISE' ? 'var(--warning)' : 'var(--muted-soft)',
                }} />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--coral)',
                  minWidth: 140,
                }}>
                  /{entry.skillName}
                </span>
                {entry.verdict && (
                  <Badge variant={entry.verdict as BadgeVariant}>{entry.verdict}</Badge>
                )}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                  {formatDuration(entry.durationMs)}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-soft)' }}>
                  {formatTime(entry.startedAt)}
                </span>
                <Link
                  href={`/dstack?skill=${entry.skillName}`}
                  onClick={e => e.stopPropagation()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    fontSize: 11, color: 'var(--coral)', fontWeight: 500,
                    padding: '3px 8px', borderRadius: 6,
                    background: 'var(--coral-bg)', border: '1px solid #f0c4b3',
                    textDecoration: 'none',
                  }}
                >
                  <RotateCcw size={10} /> Re-run
                </Link>
              </div>

              {/* Expanded details */}
              {expandedId === entry.id && (
                <div style={{
                  padding: '0 14px 12px 32px',
                  borderTop: '1px solid var(--hairline)',
                  background: 'var(--canvas)',
                  animation: 'fadeInUp 0.15s ease-out',
                }}>
                  <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--muted)', width: 80, flexShrink: 0 }}>Command</span>
                      <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{entry.command}</code>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--muted)', width: 80, flexShrink: 0 }}>Model</span>
                      <span style={{ color: 'var(--body)' }}>{entry.model}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--muted)', width: 80, flexShrink: 0 }}>Provider</span>
                      <span style={{ color: 'var(--body)' }}>{entry.provider}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--muted)', width: 80, flexShrink: 0 }}>Started</span>
                      <span style={{ color: 'var(--body)' }}>{new Date(entry.startedAt).toLocaleString()}</span>
                    </div>
                    {Object.keys(entry.inputs).length > 0 && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: 'var(--muted)', width: 80, flexShrink: 0 }}>Inputs</span>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--body)' }}>
                          {JSON.stringify(entry.inputs)}
                        </code>
                      </div>
                    )}
                    {Object.keys(entry.flags).length > 0 && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: 'var(--muted)', width: 80, flexShrink: 0 }}>Flags</span>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--body)' }}>
                          {JSON.stringify(entry.flags)}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
