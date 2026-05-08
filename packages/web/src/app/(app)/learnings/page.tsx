'use client';

import { useEffect, useState, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { api, type LearningEntry } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import { Brain, CheckCircle, XCircle, Search, Filter, Sparkles, ExternalLink } from 'lucide-react';

export default function LearningsPage() {
  const [learnings, setLearnings] = useState<LearningEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.getLearnings().then(setLearnings).catch(() => null).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    await api.updateLearningStatus(id, status).catch(() => null);
    setLearnings(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  };

  const filtered = learnings.filter(l => 
    l.pattern.toLowerCase().includes(query.toLowerCase()) || 
    l.skillName.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <AppShell>
      <div style={{ height: '100%', overflowY: 'auto', padding: 40, background: 'var(--canvas)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--coral)', marginBottom: 8 }}>
                <Brain size={24} />
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Auto-Learning System</span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 42, fontWeight: 400, color: 'var(--ink)' }}>Learning Center</h1>
              <p style={{ fontSize: 16, color: 'var(--muted)', marginTop: 8 }}>Patterns extracted from successful runs to optimize future generations.</p>
            </div>
          </header>

          <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search patterns, skills, or contexts..."
                style={{
                  width: '100%', padding: '14px 16px 14px 44px', background: '#fff', border: '1px solid var(--hairline)',
                  borderRadius: 12, fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
                }}
              />
            </div>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--hairline)',
              borderRadius: 12, padding: '0 20px', fontSize: 14, color: 'var(--ink)', fontWeight: 500, cursor: 'pointer'
            }}>
              <Filter size={16} /> Filters
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-block" style={{ height: 120, borderRadius: 16 }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', background: '#fff', borderRadius: 24, border: '1px dashed var(--hairline)' }}>
              <Sparkles size={48} style={{ color: 'var(--hairline)', marginBottom: 16 }} />
              <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--ink)' }}>No patterns yet</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>Patterns will appear here as the system learns from your skill runs.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filtered.map(l => (
                <div key={l.id} style={{ 
                  background: '#fff', border: '1px solid var(--hairline)', borderRadius: 20, padding: 24,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: l.status === 'approved' ? 'var(--success)' : l.status === 'rejected' ? 'var(--error)' : 'var(--amber)' }} />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Badge variant={l.status === 'approved' ? 'PASS' : l.status === 'rejected' ? 'FAIL' : 'PENDING'}>
                        {l.status.toUpperCase()}
                      </Badge>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
                        /{l.skillName} • {l.context}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {l.status !== 'approved' && (
                        <button onClick={() => updateStatus(l.id, 'approved')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)', padding: 4 }}>
                          <CheckCircle size={20} />
                        </button>
                      )}
                      {l.status !== 'rejected' && (
                        <button onClick={() => updateStatus(l.id, 'rejected')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: 4 }}>
                          <XCircle size={20} />
                        </button>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.5, marginBottom: 16, fontWeight: 500 }}>
                    &ldquo;{l.pattern}&rdquo;
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--hairline)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
                      <span>Run ID: {l.sourceRunId}</span>
                      <ExternalLink size={12} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(l.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
