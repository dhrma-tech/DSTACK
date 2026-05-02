'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Zap, Command, Lock, History, Clock, ArrowRight } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { Skill } from '@/lib/mock-data';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSkill: (skill: Skill) => void;
}

export default function CommandPalette({ isOpen, onClose, onSelectSkill }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const { skills } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearch('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const filteredSkills = skills.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.stage.toLowerCase().includes(search.toLowerCase())
  );

  const readyToRun = filteredSkills.filter(s => s.status !== 'blocked');
  const blocked = filteredSkills.filter(s => s.status === 'blocked');

  return (
    <div 
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(24, 23, 21, 0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '100%', maxWidth: 640,
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-premium)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--color-border-soft)' }}>
          <Search size={20} style={{ color: 'var(--color-text-muted)' }} />
          <input 
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search skills, commands, or stages..."
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'none',
              fontSize: 16, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)'
            }}
          />
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-soft)', padding: '4px 6px', borderRadius: 4 }}>ESC</div>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}>
          {readyToRun.length > 0 && (
            <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>Ready to Run</div>
          )}
          {readyToRun.map(skill => (
            <button 
              key={skill.id}
              onClick={() => onSelectSkill(skill)}
              style={{
                width: '100%', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14,
                border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.1s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-surface-soft)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                <Zap size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{skill.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{skill.stage} • 1.2m avg</div>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--color-text-muted)' }} />
            </button>
          ))}

          {blocked.length > 0 && (
            <div style={{ padding: '16px 16px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>Prerequisites Missing</div>
          )}
          {blocked.map(skill => (
            <div 
              key={skill.id}
              style={{
                padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14,
                opacity: 0.5, cursor: 'not-allowed'
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                <Lock size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{skill.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-error)' }}>Blocked by: /autoplan</div>
              </div>
            </div>
          ))}

          {filteredSkills.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: 14, marginBottom: 4 }}>No skills found for &quot;{search}&quot;</div>
              <div style={{ fontSize: 12 }}>Try searching for &quot;qa&quot;, &quot;plan&quot;, or &quot;ship&quot;.</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border-soft)', backgroundColor: 'var(--color-surface-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span style={{ padding: '2px 4px', backgroundColor: 'var(--color-surface)', borderRadius: 4, border: '1px solid var(--color-border-soft)' }}>↑↓</span> Navigate
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span style={{ padding: '2px 4px', backgroundColor: 'var(--color-surface)', borderRadius: 4, border: '1px solid var(--color-border-soft)' }}>↵</span> Select
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Command size={10} /> DStack CLI v0.8.2
          </div>
        </div>
      </div>
    </div>
  );
}
