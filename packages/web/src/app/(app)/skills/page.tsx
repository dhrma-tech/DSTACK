'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { useApp } from '@/lib/app-context';
import { HelpCircle } from 'lucide-react';
import SkillDocPanel from '@/components/SkillDocPanel';

const STAGES = ['all', 'planning', 'design', 'qa', 'ship', 'deploy'] as const;
type StageFilter = typeof STAGES[number];

export default function SkillsPage() {
  const { skills } = useApp();
  const [activeFilter, setActiveFilter] = useState<StageFilter>('all');
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  const filtered = activeFilter === 'all'
    ? skills
    : skills.filter(s => s.stage === activeFilter);

  return (
    <AppShell>
      <div style={{ height: '100%', overflowY: 'auto', padding: 24, background: 'var(--canvas)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, marginBottom: 20 }}>Skills</h1>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
          {STAGES.map(stage => (
            <button
              key={stage}
              onClick={() => setActiveFilter(stage)}
              style={{
                padding: '5px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500,
                background: activeFilter === stage ? 'var(--surface-card)' : 'transparent',
                border: `1px solid ${activeFilter === stage ? 'var(--hairline)' : 'transparent'}`,
                color: activeFilter === stage ? 'var(--ink)' : 'var(--muted)',
                borderBottom: activeFilter === stage ? '2px solid var(--coral)' : '1px solid transparent',
              }}
            >
              {stage.charAt(0).toUpperCase() + stage.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 1100 }}>
          {filtered.map(skill => (
            <div
              key={skill.name}
              style={{
                background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, padding: 16,
                opacity: skill.available ? 1 : 0.65, position: 'relative',
              }}
            >
              {!skill.available && (
                <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 14 }}>🔒</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: 'var(--coral)' }}>
                  /{skill.name}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'var(--canvas)', border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
                  {skill.model.includes('pro') || skill.model.includes('2.5') ? 'Pro' : 'Flash'}
                </span>
                <button
                  onClick={() => setExpandedSkill(expandedSkill === skill.name ? null : skill.name)}
                  style={{
                    marginLeft: 'auto', background: expandedSkill === skill.name ? 'var(--coral-bg)' : 'transparent',
                    border: 'none', cursor: 'pointer', color: expandedSkill === skill.name ? 'var(--coral)' : 'var(--muted)',
                    display: 'flex', padding: 4, borderRadius: 4, position: 'relative', zIndex: 2
                  }}
                >
                  <HelpCircle size={14} />
                </button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--body)', marginBottom: 10, lineHeight: 1.5 }}>
                {skill.description}
              </p>
              {skill.requiresArtifacts.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted-soft)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>Requires</div>
                  {skill.requiresArtifacts.map(r => (
                    <span key={r} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'var(--surface-card)', color: 'var(--muted)', border: '1px solid var(--hairline)', marginRight: 4 }}>
                      /{r}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {skill.hasLatestArtifact && skill.lastRunAt && (
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(skill.lastRunAt).toLocaleDateString()}
                  </span>
                )}
                <Link
                  href={`/dstack?skill=${skill.name}`}
                  style={{
                    marginLeft: 'auto', fontSize: 12, fontWeight: 500, padding: '4px 12px', borderRadius: 6,
                    background: skill.available ? 'var(--coral)' : 'var(--surface-card)',
                    color: skill.available ? '#fff' : 'var(--muted)',
                    pointerEvents: skill.available ? 'auto' : 'none',
                    textDecoration: 'none',
                  }}
                >
                  Run →
                </Link>
              </div>
              {expandedSkill === skill.name && <SkillDocPanel skill={skill} />}
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 24 }}>No skills in this category.</p>
        )}
      </div>
    </AppShell>
  );
}
