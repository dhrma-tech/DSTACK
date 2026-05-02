'use client';

import React, { useState, useRef, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import StatusBadge from '@/components/StatusBadge';
import JsonViewer from '@/components/JsonViewer';
import CommandPalette from '@/components/CommandPalette';
import { useApp } from '@/lib/app-context';
import { 
  Terminal, Sparkles, Command, ChevronRight, ChevronDown,
  Search, Code, Play, CheckCircle2, AlertCircle,
  Cpu, Zap, Paperclip, Send, GitBranch, Globe, 
  FileText, Shield, ShieldAlert, History, Box, 
  Maximize2, ExternalLink, Clock, User, AlertTriangle, ArrowRight
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ExecutionTurn, ToolCall, Artifact } from '@/lib/mock-data';

export default function DstackAgentPage() {
  const { project, workflow, artifacts, toast } = useApp();
  const [executionSession, setExecutionSession] = useState<ExecutionTurn[]>([]);
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'workflow' | 'artifact' | 'log'>('workflow');
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [skillLauncherOpen, setSkillLauncherOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [runningSkill, setRunningSkill] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [executionSession]);

  const handleRunCommand = async () => {
    if (!input.trim() || project.safetyMode.mode === 'GUARD') return;
    const cmd = input.trim();
    setInput('');
    
    // Add user message to thread
    const userTurn: ExecutionTurn = { id: Date.now().toString(), type: 'user', content: cmd, timestamp: new Date().toISOString() };
    setExecutionSession(prev => [...prev, userTurn]);

    // Parse command (basic) e.g., `/office-hours` or `ds /office-hours`
    const skillMatch = cmd.match(/\/([a-z0-9-]+)/i);
    const skillName = skillMatch ? skillMatch[1] : 'unknown';

    setRunningSkill(skillName);

    try {
      // Start the run on the backend
      const { runId } = await apiClient.runSkill(skillName, { provider: project.provider.current });
      setCurrentRunId(runId);

      // Connect to SSE stream
      apiClient.streamRun(runId, (event) => {
        // Translate backend RunEvents to frontend ExecutionTurns
        if (event.type === 'reasoning' || event.type === 'error') {
          setExecutionSession(prev => [
            ...prev,
            { 
              id: Date.now().toString() + Math.random(),
              type: 'tool_call', // Treat CLI stdout as a shell tool output for UI rendering purposes
              timestamp: new Date().toISOString(),
              toolCall: {
                command: 'ds /' + skillName,
                args: '',
                duration: '',
                gate: 'ALLOW',
                tool: 'shell',
                output: event.payload?.message || event.payload || ''
              }
            }
          ]);
        }
      }, () => {
        setRunningSkill(null);
        setCurrentRunId(null);
      });
    } catch (err) {
      console.error('Failed to run skill', err);
      toast('Failed to run skill. Check backend connection.', 'error');
      setRunningSkill(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRunCommand();
    }
  };

  return (
    <AppShell breadcrumbs={[{ label: project.name }, { label: 'Agent Shell' }]}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--color-canvas)',
      }}>
        {/* Mode Banners */}
        {project.safetyMode.mode === 'GUARD' && (
          <div style={{ padding: '6px 20px', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(220,38,38,0.1)' }}>
            <ShieldAlert size={12} /> GUARD MODE ACTIVE — writes and command execution are blocked.
          </div>
        )}
        {project.provider.current === 'fake' && (
          <div style={{ padding: '6px 20px', backgroundColor: '#fef3c7', color: '#d97706', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(217,119,6,0.1)' }}>
            <AlertTriangle size={12} /> FAKE PROVIDER MODE — execution results are simulated for UX testing.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', flex: 1, overflow: 'hidden' }}>
          {/* CENTER COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid var(--color-border-soft)', position: 'relative', minWidth: 0, overflow: 'hidden' }}>
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '40px 0 140px', display: 'flex', flexDirection: 'column', gap: 32, minHeight: 0 }}>
              <div style={{ maxWidth: 800, width: '100%', margin: '0 auto', padding: '0 40px' }}>
                {executionSession.map((turn) => (
                  <ThreadEvent key={turn.id} turn={turn} onViewArtifact={(a) => { setSelectedArtifact(a); setActiveTab('artifact'); }} />
                ))}
                {runningSkill && (
                  <div style={{ marginLeft: 48, marginTop: 12 }}>
                    <div style={{ 
                      display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-primary)',
                      animation: 'pulse-glow 2s infinite ease-in-out'
                    }}>
                      <span className="status-dot status-dot-running" style={{ boxShadow: '0 0 10px var(--color-primary)' }} />
                      <span style={{ fontWeight: 600, letterSpacing: '0.02em' }}>Executing {runningSkill}...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* INPUT AREA (FIXED BOTTOM) */}
            <div style={{ 
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '24px 40px 40px', 
              borderTop: '1px solid var(--color-border-soft)', 
              backgroundColor: 'var(--color-surface)', 
              zIndex: 100,
              boxShadow: '0 -10px 30px rgba(0,0,0,0.08)'
            }}>
              <div style={{ maxWidth: 800, margin: '0 auto' }}>
                <div style={{ 
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', 
                  backgroundColor: 'var(--color-surface-soft)', borderRadius: 'var(--radius-lg)', 
                  border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ fontSize: 18, color: 'var(--color-primary)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>/</div>
                  <input 
                    value={input} 
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={project.safetyMode.mode === 'GUARD'}
                    suppressHydrationWarning
                    placeholder={project.safetyMode.mode === 'GUARD' ? "Writes and execution blocked by GUARD mode..." : "Run a skill or describe what you need…"} 
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', opacity: project.safetyMode.mode === 'GUARD' ? 0.5 : 1 }} 
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: project.safetyMode.mode === 'GUARD' ? 0.5 : 1, pointerEvents: project.safetyMode.mode === 'GUARD' ? 'none' : 'auto' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--color-border-soft)' }}>⌘K</div>
                    <button 
                      onClick={handleRunCommand} 
                      disabled={project.safetyMode.mode === 'GUARD'} 
                      suppressHydrationWarning
                      style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: project.safetyMode.mode === 'GUARD' ? 'not-allowed' : 'pointer' }}>
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--color-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, padding: '12px 0', borderBottom: '1px solid var(--color-border-soft)', backgroundColor: 'var(--color-surface-soft)' }}>
              {[{ id: 'workflow', icon: GitBranch }, { id: 'artifact', icon: Box }, { id: 'log', icon: History }].map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id as any)} 
                  suppressHydrationWarning
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)', paddingBottom: 8, position: 'relative', transition: 'all 0.2s' }}>
                  <tab.icon size={20} />
                  {activeTab === tab.id && <div style={{ position: 'absolute', bottom: -12, left: 0, right: 0, height: 2, backgroundColor: 'var(--color-primary)' }} />}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {activeTab === 'workflow' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Workflow Map</h3>
                  <div style={{ padding: 16, border: '1px solid var(--color-border-soft)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-canvas)' }}>
                    {workflow.nodes.map((node, i) => (
                      <div key={node.id} style={{ display: 'flex', gap: 12, marginBottom: i === workflow.nodes.length - 1 ? 0 : 12, position: 'relative' }}>
                        {i < workflow.nodes.length - 1 && <div style={{ position: 'absolute', left: 7, top: 16, bottom: -12, width: 1, backgroundColor: 'var(--color-border-soft)' }} />}
                        <div style={{ width: 15, height: 15, borderRadius: '50%', backgroundColor: node.status === 'complete' ? 'var(--color-success)' : node.status === 'blocked' ? 'var(--color-error)' : 'var(--color-border)', border: '3px solid var(--color-surface)', zIndex: 1 }} />
                        <div style={{ fontSize: 12 }}><div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{node.label}</div><div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{node.status}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === 'artifact' && (
                <div style={{ height: '100%' }}>
                  {selectedArtifact ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Artifact Inspector</h3><button onClick={() => setSelectedArtifact(null)} suppressHydrationWarning style={{ fontSize: 10, color: 'var(--color-primary)', border: 'none', background: 'none', cursor: 'pointer' }}>Close</button></div>
                      <div className="card" style={{ padding: 16, marginBottom: 12 }}><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{selectedArtifact.relativePath.split('/').pop()}</div><div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Version: {selectedArtifact.version}</div></div>
                      <div style={{ flex: 1, minHeight: 0 }}><JsonViewer data={selectedArtifact.content || { empty: true }} title={selectedArtifact.id} /></div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', textAlign: 'center' }}><Box size={40} strokeWidth={1} style={{ marginBottom: 12 }} /><p style={{ fontSize: 13 }}>No artifact selected.</p><p style={{ fontSize: 11 }}>Run a skill or click a saved artifact to inspect.</p></div>
                  )}
                </div>
              )}
              {activeTab === 'log' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Session Log</h3>
                  {executionSession.filter(t => t.type === 'tool_call').map((t, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '8px 10px', borderLeft: '2px solid var(--color-border)', backgroundColor: 'var(--color-surface-soft)', borderRadius: '0 4px 4px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{t.toolCall?.command}</span>
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{t.toolCall?.duration}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.toolCall?.args}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <CommandPalette 
        isOpen={paletteOpen} 
        onClose={() => setPaletteOpen(false)} 
        onSelectSkill={(skill) => { setPaletteOpen(false); setSkillLauncherOpen(true); setInput(`/${skill.name}`); }}
      />
    </AppShell>
  );
}

function ThreadEvent({ turn, onViewArtifact }: { turn: ExecutionTurn, onViewArtifact: (a: Artifact) => void }) {
  const [expanded, setExpanded] = useState(true);

  if (turn.type === 'user') {
    return (
      <div style={{ marginBottom: 40 }}>
        <div style={{ backgroundColor: '#181715', color: 'white', padding: '12px 16px', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, borderLeft: '4px solid var(--color-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--color-primary)' }}>&gt;</span> {turn.content}
        </div>
      </div>
    );
  }

  if (turn.type === 'thought') {
    return (
      <div style={{ marginLeft: 48, marginBottom: 32 }}>
        <div onClick={() => setExpanded(!expanded)} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', cursor: 'pointer', backgroundColor: 'var(--color-surface-soft)', padding: '10px 16px', borderRadius: 'var(--radius-md)', borderLeft: '2px solid var(--color-border)', transition: 'all 0.2s' }}>
          <div style={{ color: 'var(--color-text-tertiary)', paddingTop: 2 }}><Sparkles size={14} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontFamily: 'var(--font-serif)', fontStyle: 'italic', lineHeight: 1.6, color: 'var(--color-text-secondary)', display: expanded ? 'block' : '-webkit-box', WebkitLineClamp: expanded ? 'none' : 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{turn.content}</div>
            {!expanded && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Click to expand reasoning...</div>}
          </div>
          <div style={{ color: 'var(--color-text-muted)' }}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
        </div>
      </div>
    );
  }

  if (turn.type === 'tool_call' && turn.toolCall) {
    const tc = turn.toolCall;
    const icons = { shell: Terminal, file: FileText, git: GitBranch, browser: Globe, skill: Zap };
    const Icon = icons[tc.tool] || Terminal;
    const borderColors = { ALLOW: '#5db872', REQUIRE_APPROVAL: '#d4a017', DENY: '#c64545' };
    return (
      <div style={{ marginLeft: 48, marginBottom: 24 }}>
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-soft)', borderRadius: 'var(--radius-md)', overflow: 'hidden', borderLeft: `3px solid ${borderColors[tc.gate]}` }}>
          <div style={{ padding: '10px 16px', backgroundColor: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon size={14} style={{ color: 'var(--color-text-secondary)' }} /><div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{tc.command}</div><div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{tc.args}</div></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span className="badge" style={{ fontSize: 9, backgroundColor: tc.gate === 'ALLOW' ? 'rgba(93,184,114,0.1)' : 'rgba(212,160,23,0.1)', color: borderColors[tc.gate] }}>{tc.gate}</span><span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{tc.duration}</span></div>
          </div>
          <div style={{ 
            padding: '12px 16px', 
            backgroundColor: tc.tool === 'shell' ? '#1e1e1e' : 'transparent',
            color: tc.tool === 'shell' ? '#d4d4d4' : 'var(--color-text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            maxHeight: 200,
            overflowY: 'auto',
            position: 'relative'
          }}>
            {tc.tool === 'shell' && (
              <div style={{ 
                position: 'absolute', top: 0, left: 0, right: 0, height: '20%', 
                background: 'linear-gradient(rgba(235, 102, 73, 0.05), transparent)',
                pointerEvents: 'none',
                animation: 'scan-line 3s infinite linear'
              }} />
            )}
            {tc.output}
          </div>
        </div>
      </div>
    );
  }

  if (turn.type === 'approval' && turn.approvalRequest) {
    const req = turn.approvalRequest;
    return (
      <div style={{ marginBottom: 40, position: 'relative' }}>
        <div style={{ backgroundColor: '#fff8e8', border: '1px solid #d4a017', borderTop: '3px solid #d4a017', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow-premium)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><ShieldAlert size={20} style={{ color: '#d4a017' }} /><h3 style={{ fontSize: 18, fontWeight: 700, color: '#4a3708' }}>Approval Required</h3></div><span className="badge" style={{ backgroundColor: req.level === 'DESTRUCTIVE' ? '#fee2e2' : '#fef3c7', color: req.level === 'DESTRUCTIVE' ? '#dc2626' : '#d97706' }}>{req.level}</span></div>
          <p style={{ fontSize: 14, color: '#715a21', lineHeight: 1.5 }}>DStack is requesting permission to execute the following action:</p>
          <div style={{ backgroundColor: 'rgba(0,0,0,0.05)', padding: '12px 16px', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 13, color: '#4a3708', border: '1px solid rgba(0,0,0,0.1)' }}>{req.action}</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}><button className="btn btn-primary" style={{ backgroundColor: 'var(--color-primary)', border: 'none', flex: 1, height: 40 }}>Approve (Y)</button><button className="btn btn-secondary" style={{ backgroundColor: 'white', border: '1px solid #d4a017', color: '#d4a017', flex: 1, height: 40 }}>Deny (N)</button></div>
        </div>
      </div>
    );
  }

  if (turn.type === 'artifact' && turn.artifact) {
    const art = turn.artifact;
    return (
      <div style={{ marginLeft: 48, marginBottom: 24 }}>
        <div style={{ backgroundColor: 'white', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(16,185,129,0.05), 0 2px 4px -2px rgba(16,185,129,0.05)', borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}><div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Box size={18} style={{ color: 'var(--color-success)' }} /></div><div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>Artifact Saved: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{art.relativePath.split('/').pop()}</span></div><div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{art.summary}</div></div></div>
          <button onClick={() => onViewArtifact(art)} suppressHydrationWarning style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 700, border: '1px solid var(--color-primary-soft)', backgroundColor: 'var(--color-primary-soft)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(235, 102, 73, 0.2)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-primary-soft)'}>View Details <ExternalLink size={14} /></button>
        </div>
        {art.verdict === 'FAIL' && (
          <div style={{ marginTop: 16, backgroundColor: '#fdecea', border: '1px solid rgba(198,69,69,0.1)', borderLeft: '4px solid #c64545', borderRadius: 'var(--radius-md)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><AlertCircle size={20} style={{ color: '#c64545' }} /><div><div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b' }}>Execution Failed: {art.skillName}</div><div style={{ fontSize: 12, color: '#991b1b' }}>{art.summary} Project flow is now blocked.</div></div></div>
            <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 11 }}>Run /investigate <ArrowRight size={12} style={{ marginLeft: 6 }} /></button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
