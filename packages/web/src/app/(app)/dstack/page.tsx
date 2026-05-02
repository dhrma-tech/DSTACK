'use client';

import React, { useState, useRef, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useApp } from '@/lib/app-context';
import { 
  Terminal, Sparkles, Command, ChevronRight, 
  Search, Code, Play, CheckCircle2, AlertCircle,
  Cpu, Zap, Paperclip, Send
} from 'lucide-react';

interface Turn {
  type: 'user' | 'thought' | 'action' | 'output';
  content: string;
  timestamp: string;
  tool?: string;
  status?: 'success' | 'error' | 'running';
}

const INITIAL_TURNS: Turn[] = [
  {
    type: 'user',
    content: 'Analyze the current project and suggest a roadmap for the next 3 sprints.',
    timestamp: '10:42 AM'
  },
  {
    type: 'thought',
    content: 'I will begin by exploring the project structure and identifying core components. I need to understand the current maturity of the /office-hours and /autoplan skills to see how they integrate into a potential roadmap.',
    timestamp: '10:42 AM'
  },
  {
    type: 'action',
    tool: 'ls -R',
    content: 'Scanning directory structure...',
    timestamp: '10:42 AM',
    status: 'success'
  },
  {
    type: 'output',
    content: 'packages/\n  shared/\n    contracts.ts\n  web/\n    src/\n      app/\n      components/\n      lib/\n.dstack/\n  artifacts/\n    roadmap.json\n    plan.json',
    timestamp: '10:42 AM'
  },
  {
    type: 'thought',
    content: 'Found existing roadmap and plan artifacts. I will now run /review to check for staleness and identify gaps in the current implementation.',
    timestamp: '10:43 AM'
  },
  {
    type: 'action',
    tool: 'run_skill /review',
    content: 'Executing project readiness review...',
    timestamp: '10:43 AM',
    status: 'running'
  }
];

export default function DstackAgentPage() {
  const { project } = useApp();
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>(INITIAL_TURNS);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newTurn: Turn = {
      type: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setTurns([...turns, newTurn]);
    setInput('');
    
    // Simulate agent response
    setTimeout(() => {
      const thought: Turn = {
        type: 'thought',
        content: `Analyzing: "${input}". I'll start by checking the relevant context.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setTurns(prev => [...prev, thought]);
    }, 1000);
  };

  return (
    <AppShell breadcrumbs={[{ label: 'DSTACK' }, { label: 'Agent Shell' }]}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: 'calc(100vh - var(--topbar-height))',
        backgroundColor: 'var(--color-canvas)',
      }}>
        {/* Chat History */}
        <div 
          ref={scrollRef}
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '40px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 32
          }}
        >
          <div style={{ maxWidth: 800, width: '100%', margin: '0 auto', padding: '0 24px' }}>
            {turns.map((turn, i) => (
              <div key={i} style={{ marginBottom: 32 }}>
                {turn.type === 'user' && (
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ 
                      width: 32, height: 32, borderRadius: '50%', 
                      backgroundColor: 'var(--color-primary-soft)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--color-primary)', flexShrink: 0
                    }}>
                      <Command size={16} />
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)', paddingTop: 2 }}>
                      {turn.content}
                    </div>
                  </div>
                )}

                {turn.type === 'thought' && (
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginLeft: 48 }}>
                    <div style={{ color: 'var(--color-text-tertiary)', paddingTop: 4 }}>
                      <Sparkles size={16} />
                    </div>
                    <div style={{ 
                      fontSize: 15, 
                      fontFamily: 'var(--font-serif)', 
                      fontStyle: 'italic',
                      lineHeight: 1.6,
                      color: 'var(--color-text-secondary)'
                    }}>
                      {turn.content}
                    </div>
                  </div>
                )}

                {turn.type === 'action' && (
                  <div style={{ 
                    marginLeft: 48, 
                    marginTop: 12,
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border-soft)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      padding: '8px 12px', 
                      backgroundColor: 'var(--color-surface-soft)',
                      borderBottom: '1px solid var(--color-border-soft)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        <Terminal size={12} /> {turn.tool}
                      </div>
                      {turn.status === 'running' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-primary)' }}>
                          <span className="status-dot status-dot-running" /> Running...
                        </div>
                      )}
                      {turn.status === 'success' && (
                        <CheckCircle2 size={12} style={{ color: 'var(--color-success)' }} />
                      )}
                    </div>
                    <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                      {turn.content}
                    </div>
                  </div>
                )}

                {turn.type === 'output' && (
                  <div style={{ 
                    marginLeft: 48, 
                    marginTop: 8,
                    backgroundColor: '#1e1e1e', // Dark terminal for output
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: '#d4d4d4',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {turn.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Persistent Input Bar (Claude style) */}
        <div style={{ 
          padding: '24px 32px 40px',
          borderTop: '1px solid var(--color-border-soft)',
          backgroundColor: 'var(--color-surface)'
        }}>
          <div style={{ 
            maxWidth: 800, 
            margin: '0 auto',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 16px',
              backgroundColor: 'var(--color-canvas)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.2s ease',
            }}
              onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
              onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
            >
              <Paperclip size={18} style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }} />
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask DStack to run a skill, review code, or explore..."
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  padding: '12px 0',
                  fontSize: 15,
                  color: 'var(--color-text-primary)'
                }}
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim()}
                style={{ 
                  width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                  backgroundColor: input.trim() ? 'var(--color-primary)' : 'var(--color-surface-soft)',
                  color: input.trim() ? 'white' : 'var(--color-text-muted)',
                  border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: input.trim() ? 'pointer' : 'default',
                  transition: 'all 0.2s'
                }}
              >
                <Send size={16} />
              </button>
            </div>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '0 4px'
            }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
                  <Cpu size={12} />
                  <span>{project.provider.current === 'fake' ? 'ds-agent-v1 (Offline)' : 'gemini-2.0-flash'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
                  <Zap size={12} />
                  <span>Safety: {project.safetyMode.mode}</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Press <span style={{ padding: '2px 4px', backgroundColor: 'var(--color-surface-soft)', borderRadius: 4, border: '1px solid var(--color-border-soft)' }}>Enter</span> to send
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
