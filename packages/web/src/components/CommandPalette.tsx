'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import type { Skill } from '@/lib/mock-data';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSkill: (skill: Skill) => void;
}

export default function CommandPalette({ isOpen, onClose, onSelectSkill }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const { skills } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? skills.filter(s =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.description.toLowerCase().includes(query.toLowerCase()) ||
        s.stage.toLowerCase().includes(query.toLowerCase())
      )
    : skills;

  const readySkills  = filtered.filter(s => s.available);
  const blockedSkills = filtered.filter(s => !s.available);

  const navigable = readySkills;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, navigable.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') {
      const skill = navigable[activeIdx];
      if (skill) { onSelectSkill(skill); onClose(); }
    }
  }, [isOpen, navigable, activeIdx, onClose, onSelectSkill]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(20,20,19,0.5)',
        display: 'flex', justifyContent: 'center', paddingTop: '15vh',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 640, background: '#ffffff',
          borderRadius: 12, border: '1px solid var(--hairline)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          maxHeight: '70vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input bar */}
        <div style={{
          height: 52, background: 'var(--surface-dark)',
          display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
        }}>
          <span style={{ color: 'var(--coral)', fontFamily: 'var(--font-mono)', fontSize: 18, flexShrink: 0 }}>/</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search skills…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--on-dark)',
              caretColor: 'var(--coral)',
            }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-dark-soft)' }}>
            ESC to close
          </span>
        </div>

        {/* Sections */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {readySkills.length > 0 && (
            <>
              <SectionLabel>Ready to run</SectionLabel>
              {readySkills.map((skill) => (
                <SkillRow
                  key={skill.name}
                  skill={skill}
                  active={navigable.indexOf(skill) === activeIdx}
                  onClick={() => { onSelectSkill(skill); onClose(); }}
                />
              ))}
            </>
          )}

          {blockedSkills.length > 0 && (
            <>
              <SectionLabel>Blocked</SectionLabel>
              {blockedSkills.map(skill => (
                <BlockedRow key={skill.name} skill={skill} />
              ))}
            </>
          )}

          {filtered.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
              No skills found for &quot;{query}&quot;
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          height: 36, background: 'var(--surface-card)', borderTop: '1px solid var(--hairline)',
          display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px',
          fontSize: 11, color: 'var(--muted)',
        }}>
          <span><kbd style={kbdStyle}>↑↓</kbd> navigate</span>
          <span><kbd style={kbdStyle}>↵</kbd> select</span>
          <span><kbd style={kbdStyle}>ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 16px 4px', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted-soft)' }}>
      {children}
    </div>
  );
}

function SkillRow({ skill, active, onClick }: { skill: Skill; active: boolean; onClick: () => void }) {
  const modelLabel = skill.model.includes('pro') || skill.model.includes('2.5') ? 'Pro' : 'Flash';
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', height: 44, padding: '0 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        border: 'none', cursor: 'pointer', textAlign: 'left',
        background: active ? 'var(--coral-bg)' : '#fff',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#f5f3f0'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
        /{skill.name}
      </span>
      <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {skill.description}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'var(--canvas)', border: '1px solid var(--hairline)', color: 'var(--muted)', flexShrink: 0 }}>
        {modelLabel}
      </span>
    </button>
  );
}

function BlockedRow({ skill }: { skill: Skill }) {
  return (
    <div style={{
      height: 44, padding: '0 16px',
      display: 'flex', alignItems: 'center', gap: 10, cursor: 'default',
    }}>
      <Lock size={12} style={{ color: 'var(--muted-soft)', flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted-soft)' }}>
        /{skill.name}
      </span>
      <span style={{ fontSize: 12, color: 'var(--muted-soft)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {skill.description}
      </span>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--hairline)', borderRadius: 4,
  padding: '1px 5px', fontFamily: 'var(--font-mono)', fontSize: 10,
};
