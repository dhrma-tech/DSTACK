'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, GitBranch, Zap, History, Box, Globe,
  Rocket, BarChart3, Brain, Settings, Shield, Cpu,
  CheckCircle2, Lock, Circle,
} from 'lucide-react';
import { useApp } from '@/lib/app-context';

const NAV = [
  { section: 'CORE', items: [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/workflow',  icon: GitBranch,       label: 'Workflow' },
    { href: '/skills',   icon: Zap,             label: 'Skills' },
    { href: '/runs',     icon: History,         label: 'Runs' },
  ]},
  { section: 'DATA', items: [
    { href: '/artifacts', icon: Box,   label: 'Artifacts' },
    { href: '/browser',   icon: Globe, label: 'Browser / QA' },
  ]},
  { section: 'OPS', items: [
    { href: '/deploy',     icon: Rocket,   label: 'Deploy' },
    { href: '/benchmarks', icon: BarChart3, label: 'Benchmarks' },
    { href: '/learnings',  icon: Brain,    label: 'Learnings' },
  ]},
];

const WORKFLOW_STAGES = [
  { id: 'planning', label: 'Planning' },
  { id: 'design',   label: 'Design' },
  { id: 'qa',       label: 'Build / QA' },
  { id: 'ship',     label: 'Ship' },
  { id: 'deploy',   label: 'Deploy' },
];

const STAGE_ORDER: Record<string, number> = {
  planning: 0, design: 1, qa: 2, 'build/qa': 2, ship: 3, shipped: 3, deploy: 4, deployed: 4,
};

function StageRow({ label, stageIdx, currentIdx }: { label: string; stageIdx: number; currentIdx: number }) {
  const isDone = stageIdx < currentIdx;
  const isCurrent = stageIdx === currentIdx;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, height: 28, padding: '0 12px',
      borderLeft: isCurrent ? '2px solid var(--coral)' : '2px solid transparent',
      background: isCurrent ? 'rgba(204,120,92,0.06)' : 'transparent',
      paddingLeft: isCurrent ? 10 : 12,
    }}>
      {isDone
        ? <CheckCircle2 size={12} style={{ color: 'var(--success)', flexShrink: 0 }} />
        : isCurrent
          ? <Circle size={12} style={{ color: 'var(--coral)', flexShrink: 0, fill: 'var(--coral)' }} />
          : <Circle size={12} style={{ color: 'var(--hairline)', flexShrink: 0 }} />
      }
      <span style={{
        fontSize: 12, color: isCurrent ? 'var(--ink)' : isDone ? 'var(--body)' : 'var(--muted-soft)',
        fontWeight: isCurrent ? 500 : 400,
      }}>
        {label}
      </span>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { project, skills } = useApp();

  const currentStageIdx = STAGE_ORDER[project.workflowStage ?? 'planning'] ?? 0;

  // Quick-launch skills (first 8, visible)
  const quickSkills = skills.filter(s => !s.hidden).slice(0, 8);

  const isActive = (href: string) => {
    // Handle (app) route group — pathnames won't have /dstack prefix
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/(app)/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 'var(--topbar-height)', bottom: 'var(--statusbar-height)',
      width: 'var(--sidebar-width)', background: 'var(--surface-card)',
      borderRight: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column',
      overflowY: 'auto', zIndex: 40,
    }}>
      {/* Zone A — Project identity */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: project.artifactCounts.stale > 0 ? 'var(--warning)' : 'var(--success)',
          }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}
          </span>
        </div>
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
          <GitBranch size={9} /> main
        </div>
      </div>

      {/* Zone B — Workflow stage tracker */}
      <div style={{ padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
        <div style={{ padding: '6px 16px 2px', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted-soft)' }}>
          Workflow
        </div>
        {WORKFLOW_STAGES.map((stage, i) => (
          <StageRow key={stage.id} label={stage.label} stageIdx={i} currentIdx={currentStageIdx} />
        ))}
      </div>

      {/* Zone C — Navigation */}
      <div style={{ flex: 1, padding: '8px 0' }}>
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <div style={{ padding: '10px 16px 2px', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted-soft)' }}>
              {section}
            </div>
            {items.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className={`sidebar-item${isActive(href) ? ' active' : ''}`}
              >
                <Icon size={14} style={{ color: isActive(href) ? 'var(--ink)' : 'var(--muted)', flexShrink: 0 }} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        ))}

        {/* Zone D — Quick Launch */}
        {quickSkills.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ padding: '10px 16px 2px', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted-soft)' }}>
              Quick Launch
            </div>
            {quickSkills.map(skill => (
              <Link
                key={skill.name}
                href={`/dstack?skill=${skill.name}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, height: 28, padding: '0 12px',
                  cursor: skill.available ? 'pointer' : 'not-allowed',
                  textDecoration: 'none',
                }}
              >
                {skill.available
                  ? <Zap size={11} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                  : <Lock size={11} style={{ color: 'var(--muted-soft)', flexShrink: 0 }} />
                }
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: skill.available ? 'var(--body)' : 'var(--muted-soft)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  /{skill.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Zone E — System footer */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Cpu size={10} /> gemini-flash
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Shield size={10} /> {project.safetyMode.mode}
          </span>
        </div>
        {project.freezeState.frozen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--error)', fontWeight: 500 }}>
            <Lock size={10} /> FROZEN
          </div>
        )}
        <Link href="/settings" className={`sidebar-item${isActive('/settings') ? ' active' : ''}`} style={{ marginTop: 2 }}>
          <Settings size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
