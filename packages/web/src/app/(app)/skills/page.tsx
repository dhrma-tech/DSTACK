'use client';

import React, { useState } from 'react';
import AppShell from '@/components/AppShell';
import StatusBadge from '@/components/StatusBadge';
import { useApp } from '@/lib/app-context';
import Link from 'next/link';
import { Search, Zap, Layers, Code2, Box, Play } from 'lucide-react';

const STAGE_ORDER = ['planning', 'design', 'qa', 'shipped'];

export default function SkillsPage() {
  const { skills } = useApp();
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  const filtered = skills
    .filter(s => showHidden || !s.hidden)
    .filter(s => s.name.includes(search.toLowerCase()) || s.command.includes(search.toLowerCase()));

  const grouped = STAGE_ORDER.map((stage: string) => ({
    stage,
    skills: filtered.filter((s: any) => s.stage === stage),
  })).filter(g => g.skills.length > 0);

  const stageIcon = (stage: string) => {
    if (stage === 'planning') return <Layers size={14} />;
    if (stage === 'design') return <Box size={14} />;
    if (stage === 'qa') return <Code2 size={14} />;
    return <Zap size={14} />;
  };

  return (
    <AppShell breadcrumbs={[{ label: 'Skills' }]}>
      <div style={{ padding: '32px' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontFamily: 'var(--font-serif)', marginBottom: 4 }}>Skill Library</h1>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>
            Browse and run structured AI skills in your DStack environment.
          </p>
        </div>

        {/* Search + Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface)' }}>
            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
            <input className="input" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search skills..." style={{ border: 'none', padding: '8px 0', boxShadow: 'none' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />
            Show hidden
          </label>
        </div>

        {/* Grouped Skills */}
        {grouped.map((group: any) => (
          <div key={group.stage} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--color-text-muted)' }}>
              {stageIcon(group.stage)}
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{group.stage}</span>
              <span style={{ fontSize: 11 }}>({group.skills.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border-soft)' }}>
              {group.skills.map((skill: any) => (
                <div key={skill.name} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 100px 80px',
                  alignItems: 'center', gap: 16, padding: '14px 20px',
                  backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border-soft)',
                  transition: 'background 0.1s', cursor: 'pointer',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-canvas)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{skill.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-muted)' }}>{skill.command}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{skill.description}</div>
                  </div>
                  <div>
                    <StatusBadge
                      status={skill.maturity === 'complete' ? 'success' : skill.maturity === 'partial' ? 'warning' : 'idle'}
                      label={skill.maturity}
                    />
                  </div>
                  <div>
                    {skill.hasLatestArtifact
                      ? <span style={{ fontSize: 12, color: 'var(--color-success)' }}>✓ Artifact</span>
                      : <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>—</span>
                    }
                  </div>
                  <div>
                    {skill.available
                      ? <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 11, height: 28 }} title="Run this skill">
                          <Play size={10} /> Run
                        </button>
                      : <button className="btn btn-secondary" disabled style={{ padding: '4px 12px', fontSize: 11, height: 28 }}
                          title={`Missing: ${skill.requiresArtifacts.join(', ')}`}>
                          Blocked
                        </button>
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
