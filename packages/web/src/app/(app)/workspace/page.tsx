'use client';

import React, { useState } from 'react';
import AppShell from '@/components/AppShell';
import StatusBadge from '@/components/StatusBadge';
import { useApp } from '@/lib/app-context';
import {
  Play, Terminal as TerminalIcon, FileCode, Search,
  ChevronRight, Box, Cpu, CheckCircle2
} from 'lucide-react';

import { useActiveRun } from '@/hooks/useActiveRun';
import EventThread from '@/components/shell/EventThread';

export default function WorkspacePage() {
  const { project, skills, artifacts } = useApp();
  const [inputValue, setInputValue] = useState('');
  const { startRun, events, status, respondToApproval, isExecuting } = useActiveRun();

  const handleRun = () => {
    if (!inputValue.trim()) return;
    
    // Check if it's a skill command
    if (inputValue.startsWith('/')) {
      const parts = inputValue.split(' ');
      const skillName = parts[0].substring(1);
      const args: Record<string, string> = {};
      
      // Basic arg parsing
      for (let i = 1; i < parts.length; i++) {
        if (parts[i].startsWith('--')) {
          const [key, val] = parts[i].substring(2).split('=');
          args[key] = val;
        }
      }
      
      startRun(skillName, args);
    } else {
      // General prompt handling could go here
      startRun('office-hours', { idea: inputValue });
    }
  };

  const projectFiles = [
    'skills/office-hours.ts',
    'skills/autoplan.ts',
    'pipelines/alpha.json',
    'artifacts/roadmap.json',
  ];

  return (
    <AppShell
      breadcrumbs={[{ label: 'Workspace' }, { label: 'Execution' }]}
      actions={
        <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12, height: 30 }} onClick={handleRun}>
          <Play size={12} /> Run Skill
        </button>
      }
    >
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', height: '100%' }}>
        {/* Project Browser */}
        <div style={{
          width: 240, minWidth: 240,
          borderRight: '1px solid var(--color-border-soft)',
          display: 'flex', flexDirection: 'column',
          backgroundColor: 'var(--color-surface)',
        }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--color-border-soft)' }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
              Project Files
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              backgroundColor: 'var(--color-surface-soft)', padding: '6px 10px',
              borderRadius: 'var(--radius-sm)', fontSize: 12,
            }}>
              <Search size={12} style={{ color: 'var(--color-text-muted)' }} />
              <input className="input" placeholder="Search..." style={{ border: 'none', padding: '2px 0', fontSize: 12, background: 'none', boxShadow: 'none' }} />
            </div>
          </div>
          <div style={{ padding: '8px 0', overflowY: 'auto', flex: 1 }}>
            {projectFiles.map((file: string) => (
              <div key={file} style={{
                padding: '7px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer', color: 'var(--color-text-secondary)',
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-soft)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <FileCode size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                <span>{file}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Execution Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, padding: 40, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ maxWidth: 720, width: '100%' }}>
              <h1 style={{ fontSize: 28, fontFamily: 'var(--font-serif)', marginBottom: 20, textAlign: 'center' }}>
                What should DStack execute?
              </h1>

              {/* Input */}
              <div style={{ position: 'relative', marginBottom: 32 }}>
                <textarea
                  placeholder="Ask anything, @ to use skills or mention files..."
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  style={{
                    width: '100%', minHeight: 100, padding: 16,
                    borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
                    fontFamily: 'var(--font-sans)', fontSize: 14,
                    resize: 'none', outline: 'none',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
                />
                <div style={{ position: 'absolute', bottom: 10, right: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Cpu size={11} /> {project.provider.current === 'fake' ? 'Fake Provider' : 'Gemini 2.0 Flash'}
                  </span>
                  <button className="btn btn-primary" style={{ width: 28, height: 28, padding: 0, borderRadius: '50%' }} onClick={handleRun}>
                    <Play size={12} />
                  </button>
                </div>
              </div>

              {/* Execution Output */}
              {status !== 'idle' && (
                <div style={{ marginTop: 8, marginBottom: 24, width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <StatusBadge status={status === 'connected' ? 'running' : 'complete'} label={status === 'connected' ? 'Executing' : 'Execution Finished'} />
                    {status === 'error' && <span style={{ color: 'var(--color-error)', fontSize: 12 }}>Run failed</span>}
                  </div>
                  
                  <EventThread events={events} onApproval={respondToApproval} />
                </div>
              )}

              {/* Suggestions */}
              {status === 'idle' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Run Office Hours', desc: 'Brainstorm product strategy with AI.', cmd: '/office-hours --idea "Build a SaaS"' },
                    { label: 'Update Auto Plan', desc: 'Synchronize project state with current PRs.', cmd: '/autoplan --source "roadmap.json"' },
                  ].map((s: any) => (
                    <div key={s.label} className="card card-interactive" style={{ padding: 14, cursor: 'pointer' }}
                      onClick={() => setInputValue(s.cmd)}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{s.desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Inspector */}
        <div style={{
          width: 280, minWidth: 280,
          borderLeft: '1px solid var(--color-border-soft)',
          backgroundColor: 'var(--color-surface)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-soft)' }}>
            <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
              State Inspector
            </div>
          </div>
          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            {/* Context */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: 10 }}>Context</div>
              {[
                { k: 'Branch', v: 'main' },
                { k: 'Provider', v: project.provider.current },
                { k: 'Safety', v: project.safetyMode.mode },
              ].map(row => (
                <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                  <span style={{ color: 'var(--color-text-tertiary)' }}>{row.k}</span>
                  <span style={{ fontWeight: 500 }}>{row.v}</span>
                </div>
              ))}
            </div>

            {/* Artifacts */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: 10 }}>
                Artifacts ({artifacts.filter((a: any) => a.isLatest).length})
              </div>
              {artifacts.filter((a: any) => a.isLatest).map((art: any) => (
                <div key={art.id} style={{
                  padding: '5px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-soft)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Box size={11} style={{ color: 'var(--color-primary)' }} />
                  {art.relativePath.split('/').pop()}
                </div>
              ))}
            </div>

            {/* Active Agent */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: 10 }}>Active Agents</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span className="status-dot status-dot-success" />
                SkillRunner: Listening
              </div>
            </div>
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border-soft)', fontSize: 11, color: 'var(--color-text-muted)' }}>
            Connected to local DStack daemon v0.8.2
          </div>
        </div>
      </div>
    </AppShell>
  );
}
