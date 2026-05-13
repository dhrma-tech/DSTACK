'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { api, type ShellEvent } from '@/lib/api';
import { Play, Plus, X, Cpu, Activity } from 'lucide-react';

interface AgentTerminal {
  id: string;
  skillName: string;
  status: 'idle' | 'running' | 'complete' | 'error';
  events: ShellEvent[];
}

export default function PlaygroundPage() {
  const [agents, setAgents] = useState<AgentTerminal[]>([
    { id: 'agent-1', skillName: 'investigate', status: 'idle', events: [] }
  ]);

  const addAgent = () => {
    setAgents(prev => [...prev, { 
      id: `agent-${Date.now()}`, 
      skillName: 'review', 
      status: 'idle', 
      events: [] 
    }]);
  };

  const removeAgent = (id: string) => {
    setAgents(prev => prev.filter(a => a.id !== id));
  };

  const runAgent = async (id: string) => {
    const agent = agents.find(a => a.id === id);
    if (!agent) return;

    setAgents(prev => prev.map(a => a.id === id ? { ...a, status: 'running', events: [] } : a));

    try {
      const { runId } = await api.runSkill(agent.skillName);
      api.streamRun(runId, (event) => {
        setAgents(prev => prev.map(a => a.id === id ? { ...a, events: [...a.events, event] } : a));
      }, () => {
        setAgents(prev => prev.map(a => a.id === id ? { ...a, status: 'complete' } : a));
      });
    } catch (_err) {
      setAgents(prev => prev.map(a => a.id === id ? { ...a, status: 'error' } : a));
    }
  };

  return (
    <AppShell>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--canvas)' }}>
        <header style={{ padding: '20px 24px', borderBottom: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400 }}>Multi-Agent Playground</h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Execute and monitor multiple agent skills concurrently.</p>
          </div>
          <button 
            onClick={addAgent}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--ink)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            <Plus size={18} /> Spawn Agent
          </button>
        </header>

        <div style={{ flex: 1, padding: 24, display: 'grid', gridTemplateColumns: agents.length > 1 ? '1fr 1fr' : '1fr', gap: 24, overflowY: 'auto' }}>
          {agents.map((agent) => (
            <div key={agent.id} style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: agent.status === 'running' ? 'var(--coral)' : agent.status === 'complete' ? 'var(--success)' : 'var(--muted-soft)', animation: agent.status === 'running' ? 'pulse 1.5s infinite' : 'none' }} />
                  <input 
                    value={agent.skillName}
                    onChange={e => setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, skillName: e.target.value } : a))}
                    disabled={agent.status === 'running'}
                    style={{ background: 'none', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)', width: 120, outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    onClick={() => runAgent(agent.id)}
                    disabled={agent.status === 'running'}
                    style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Play size={12} fill="currentColor" /> RUN
                  </button>
                  <button onClick={() => removeAgent(agent.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, background: '#0a0a0a', padding: 16, fontFamily: 'var(--font-mono)', fontSize: 12, overflowY: 'auto', color: '#e0e0e0', minHeight: 300 }}>
                {agent.events.length === 0 && <div style={{ color: '#666' }}>// Agent idle. Enter skill name and click RUN.</div>}
                {agent.events.map((ev, i) => (
                  <div key={i} style={{ marginBottom: 4, lineHeight: 1.5 }}>
                    {ev.type === 'reasoning' && <span style={{ color: '#888' }}>{ev.text}</span>}
                    {ev.type === 'tool-call' && <span style={{ color: 'var(--coral)' }}>➜ calling {ev.toolName}({JSON.stringify(ev.args).slice(0, 40)}...)</span>}
                    {ev.type === 'tool-result' && <span style={{ color: 'var(--success)' }}>✔ {ev.toolName} returned {ev.output.length} chars</span>}
                    {ev.type === 'artifact-saved' && <span style={{ color: 'var(--amber)' }}>💾 artifact saved: {ev.path}</span>}
                    {ev.type === 'complete' && <div style={{ color: 'var(--success)', fontWeight: 700, marginTop: 8 }}>● RUN COMPLETE ({ev.verdict})</div>}
                    {ev.type === 'error' && <div style={{ color: 'var(--error)', fontWeight: 700 }}>✖ ERROR: {ev.message}</div>}
                  </div>
                ))}
              </div>

              <div style={{ padding: '8px 16px', borderTop: '1px solid var(--hairline)', background: 'var(--surface-card)', display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>
                  <Cpu size={12} /> GEMINI 2.0 FLASH
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>
                  <Activity size={12} /> {agent.events.filter(e => e.type === 'tool-call').length} TOOLS
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
