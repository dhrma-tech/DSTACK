'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Square, Sparkles } from 'lucide-react';
import type { SkillSummary, WorkflowSuggestion } from '@/lib/api';
import SkillRunnerPanel from './SkillRunnerPanel';

type InputMode = 'idle' | 'skill-selected' | 'running';

interface CommandInputProps {
  skills: SkillSummary[];
  suggestions?: WorkflowSuggestion[];
  isRunning: boolean;
  currentSkill: string | null;
  toolCallCount?: number;
  onRun: (skillName: string, inputs: Record<string, string>, flags: { dryRun: boolean; force: boolean; model: string }) => void;
  onStop: () => void;
  disabled?: boolean;
}

export default function CommandInput({
  skills,
  suggestions = [],
  isRunning,
  currentSkill,
  toolCallCount = 0,
  onRun,
  onStop,
  disabled,
}: CommandInputProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<InputMode>('idle');
  const [selectedSkill, setSelectedSkill] = useState<SkillSummary | null>(null);
  const [autocompleteIdx, setAutocompleteIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const startTime = useRef<number>(0);

  // Running timer
  useEffect(() => {
    if (isRunning) {
      startTime.current = Date.now();
      const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
      return () => clearInterval(id);
    } else {
      setElapsed(0);
    }
  }, [isRunning]);

  // Switch to running mode automatically
  useEffect(() => {
    if (isRunning) setMode('running');
    else if (mode === 'running') setMode('idle');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const closePanel = useCallback(() => {
    setMode('idle');
    setSelectedSkill(null);
    setText('');
  }, []);

  // Autocomplete matches
  const query = text.startsWith('/') ? text.slice(1) : text;
  const matches = query
    ? skills.filter(s => s.name.toLowerCase().startsWith(query.toLowerCase())).slice(0, 6)
    : [];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAutocompleteIdx(i => Math.min(i + 1, matches.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setAutocompleteIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      const skill = matches[autocompleteIdx];
      if (skill) { setSelectedSkill(skill); setMode('skill-selected'); setText(''); }
    }
    if (e.key === 'Escape') closePanel();
  };

  const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // RUNNING mode
  if (mode === 'running') {
    return (
      <div style={{
        borderTop: '1px solid var(--hairline)', flexShrink: 0,
        background: `linear-gradient(rgba(204,120,92,0.08), rgba(204,120,92,0.08)), var(--surface-dark)`,
        height: 52, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--coral)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--coral)' }}>
          {currentSkill ? `/${currentSkill}` : 'Running'}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--on-dark-soft)' }}>
          {formatElapsed(elapsed)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--on-dark-soft)' }}>
          {toolCallCount} tool calls
        </span>
        <button
          onClick={onStop}
          style={{
            marginLeft: 'auto', border: '1px solid var(--error)', color: 'var(--error)',
            background: 'transparent', borderRadius: 6, padding: '4px 12px',
            fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <Square size={12} /> Stop
        </button>
      </div>
    );
  }

  // SKILL-SELECTED mode — show panel above + collapsed bar below
  if (mode === 'skill-selected' && selectedSkill) {
    return (
      <div style={{ flexShrink: 0 }}>
        <SkillRunnerPanel
          skill={selectedSkill}
          onClose={closePanel}
          onRun={(name, inputs, flags) => {
            onRun(name, inputs, flags);
          }}
        />
        <div style={{
          height: 52, background: 'var(--surface-dark)', borderTop: '1px solid #2a2825',
          display: 'flex', alignItems: 'center', padding: '0 16px',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--coral)' }}>/{selectedSkill.name}</span>
          <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--on-dark-soft)' }}>selected — press ⌘↵ to run</span>
        </div>
      </div>
    );
  }

  // IDLE mode
  return (
    <div style={{ flexShrink: 0, position: 'relative' }}>
      {/* Autocomplete dropdown */}
      {matches.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0,
          background: 'var(--surface-dark-elevated)', border: '1px solid #333',
          borderRadius: 10, overflow: 'hidden', zIndex: 10,
        }}>
          {matches.map((skill, i) => (
            <button
              key={skill.name}
              onMouseDown={(e) => { e.preventDefault(); setSelectedSkill(skill); setMode('skill-selected'); setText(''); }}
              style={{
                width: '100%', height: 40, padding: '0 14px',
                display: 'flex', alignItems: 'center', gap: 8,
                border: 'none', cursor: 'pointer', textAlign: 'left',
                background: i === autocompleteIdx ? 'rgba(204,120,92,0.12)' : 'transparent',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--on-dark)' }}>
                /{skill.name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--on-dark-soft)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {skill.description}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-dark-soft)', flexShrink: 0 }}>
                {skill.model.includes('pro') || skill.model.includes('2.5') ? 'Pro' : 'Flash'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Context-aware suggestions when input is empty */}
      {!text && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0,
          background: 'var(--surface-dark-elevated)', border: '1px solid #333',
          borderRadius: 10, overflow: 'hidden', zIndex: 10,
          padding: '8px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 14px 8px', borderBottom: '1px solid #333' }}>
            <Sparkles size={11} style={{ color: 'var(--coral)' }} />
            <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--coral)' }}>
              Suggested
            </span>
          </div>
          {suggestions.slice(0, 3).map((s) => (
            <button
              key={s.skill}
              onMouseDown={(e) => {
                e.preventDefault();
                const skill = skills.find(sk => sk.name === s.skill);
                if (skill) { setSelectedSkill(skill); setMode('skill-selected'); setText(''); }
              }}
              style={{
                width: '100%', padding: '8px 14px',
                display: 'flex', alignItems: 'flex-start', gap: 10,
                border: 'none', cursor: 'pointer', textAlign: 'left',
                background: 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(204,120,92,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                width: 18, height: 18, borderRadius: '50%',
                background: s.category === 'critical' ? 'rgba(198,69,69,0.2)' : s.category === 'recommended' ? 'rgba(204,120,92,0.2)' : 'rgba(91,125,196,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 600, flexShrink: 0, marginTop: 1,
                color: s.category === 'critical' ? 'var(--error)' : s.category === 'recommended' ? 'var(--coral)' : '#5b7dc4',
              }}>
                {s.priority}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--on-dark)' }}>
                  /{s.skill}
                </span>
                <div style={{ fontSize: 11, color: 'var(--on-dark-soft)', marginTop: 2, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                  {s.reason}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}


      {/* Input bar */}
      <div style={{
        height: 52, background: 'var(--surface-dark)', borderTop: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10,
      }}>
        <span style={{ color: 'var(--coral)', fontFamily: 'var(--font-mono)', fontSize: 18, flexShrink: 0 }}>/</span>
        <input
          ref={inputRef}
          value={text}
          onChange={e => { setText(e.target.value); setAutocompleteIdx(0); }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? 'GUARD MODE ACTIVE — writes and execute commands blocked' : 'Run a skill or describe what you need…'}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--on-dark)',
            caretColor: 'var(--coral)',
          }}
        />
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-dark-soft)',
          background: 'var(--surface-dark-elevated)', border: '1px solid #333',
          borderRadius: 4, padding: '2px 8px', flexShrink: 0,
        }}>
          ⌘K
        </div>
      </div>
    </div>
  );
}
