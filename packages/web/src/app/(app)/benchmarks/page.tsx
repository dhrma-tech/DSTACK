'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api, type BenchmarkRun } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Cell 
} from 'recharts';
import { 
  BarChart3, Clock, Target, TrendingUp, Activity, 
  Calendar, Layers, ShieldCheck 
} from 'lucide-react';

export default function BenchmarksPage() {
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [selected, setSelected] = useState<BenchmarkRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBenchmarks().then(r => { 
      setRuns(r); 
      if (r.length) setSelected(r[0]); 
    }).catch(() => null).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <AppShell><div style={{ padding: 40 }}><div className="skeleton skeleton-title" style={{ width: 300, height: 40 }} /></div></AppShell>;
  }

  return (
    <AppShell>
      <div style={{ display: 'flex', height: '100%', background: 'var(--canvas)', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid var(--hairline)', background: '#fff', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--hairline)' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: 'var(--ink)' }}>Intelligence</h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Model calibration & performance</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px 8px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>Run History</div>
            {runs.map(run => (
              <div
                key={run.id}
                onClick={() => setSelected(run)}
                style={{
                  padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid var(--hairline)',
                  background: selected?.id === run.id ? 'var(--coral-bg)' : 'transparent',
                  borderLeft: `3px solid ${selected?.id === run.id ? 'var(--coral)' : 'transparent'}`,
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{run.suite}</span>
                  {run.fakeMode && <Badge variant="FAKE">FAKE</Badge>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
                  <Calendar size={12} />
                  <span>{new Date(run.date).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{run.results.length} models</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 40 }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)' }}>
              Select a benchmark suite to view performance analytics
            </div>
          ) : (
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--coral)', marginBottom: 8 }}>
                    <Activity size={20} />
                    <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Calibration Report</span>
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 400 }}>{selected.suite}</h2>
                </div>
                {selected.fakeMode && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff8e8', border: '1px solid #e8c97a', padding: '8px 16px', borderRadius: 12, fontSize: 13, color: '#7d5200' }}>
                    <ShieldCheck size={16} /> <span>Simulation Data (Fake Mode)</span>
                  </div>
                )}
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 40 }}>
                {[
                  { label: 'Top Model', value: selected.results.sort((a,b) => b.quality - a.quality)[0].model, icon: Target, color: 'var(--coral)' },
                  { label: 'Avg Quality', value: `${Math.round(selected.results.reduce((a,b) => a+b.quality, 0) / selected.results.length)}%`, icon: TrendingUp, color: 'var(--success)' },
                  { label: 'Avg Latency', value: `${Math.round(selected.results.reduce((a,b) => a+b.latencyMs, 0) / selected.results.length)}ms`, icon: Clock, color: 'var(--amber)' },
                  { label: 'Total Tokens', value: selected.results.reduce((a,b) => a+(b.tokens||0), 0).toLocaleString(), icon: Layers, color: '#4f46e5' },
                ].map((stat, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 20, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 12 }}>
                      <stat.icon size={14} style={{ color: stat.color }} /> {stat.label}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', fontFamily: stat.label.includes('Model') ? 'var(--font-mono)' : 'inherit' }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Charts Section */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginBottom: 40 }}>
                {/* Quality vs Latency Chart */}
                <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 24, padding: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart3 size={18} /> Quality Score by Model
                  </h3>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={selected.results} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--hairline)" />
                        <XAxis dataKey="model" fontSize={10} tickLine={false} axisLine={false} hide />
                        <YAxis domain={[0, 100]} fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          itemStyle={{ fontSize: 12, fontWeight: 600 }}
                        />
                        <Bar dataKey="quality" radius={[4, 4, 0, 0]}>
                          {selected.results.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.quality > 85 ? 'var(--coral)' : 'var(--muted)'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Latency Comparison */}
                <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 24, padding: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={18} /> Latency (ms)
                  </h3>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={selected.results} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--amber)" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="var(--amber)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--hairline)" />
                        <XAxis dataKey="model" hide />
                        <YAxis fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                           contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Area type="monotone" dataKey="latencyMs" stroke="var(--amber)" fillOpacity={1} fill="url(#colorLatency)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 24, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--hairline)' }}>
                      {['Model', 'Quality', 'Latency', 'Tokens', 'Cost Index'].map(h => (
                        <th key={h} style={{ padding: '16px 24px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.results.map(r => (
                      <tr key={r.model} style={{ borderBottom: '1px solid var(--hairline)', transition: 'background 0.2s' }}>
                        <td style={{ padding: '20px 24px' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{r.model}</div>
                        </td>
                        <td style={{ padding: '20px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, width: 60, height: 6, background: 'var(--hairline)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${r.quality}%`, height: '100%', background: r.quality > 85 ? 'var(--coral)' : 'var(--muted)' }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{r.quality}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '20px 24px', fontSize: 13, color: 'var(--body)' }}>{r.latencyMs}ms</td>
                        <td style={{ padding: '20px 24px', fontSize: 13, color: 'var(--body)' }}>{r.tokens?.toLocaleString() ?? '—'}</td>
                        <td style={{ padding: '20px 24px' }}>
                           <Badge variant={r.tokens && r.tokens > 1000 ? 'REVISE' : 'PASS'}>
                             {r.tokens && r.tokens > 1000 ? 'HIGH' : 'OPTIMAL'}
                           </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
