'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, GitBranch, Zap, History,
  Box, Globe, Rocket, BarChart3, Brain,
  Settings, ChevronLeft, ChevronRight, Terminal,
  Lock, Cpu, Shield
} from 'lucide-react';
import { useApp } from '@/lib/app-context';

const NAV_SECTIONS = [
  {
    label: 'Core',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/workflow', icon: GitBranch, label: 'Workflow' },
      { href: '/skills', icon: Zap, label: 'Skills' },
      { href: '/runs', icon: History, label: 'Runs' },
    ],
  },
  {
    label: 'Data',
    items: [
      { href: '/artifacts', icon: Box, label: 'Artifacts' },
      { href: '/browser', icon: Globe, label: 'Browser / QA' },
    ],
  },
  {
    label: 'Ops',
    items: [
      { href: '/deploy', icon: Rocket, label: 'Deploy' },
      { href: '/benchmarks', icon: BarChart3, label: 'Benchmarks' },
      { href: '/learnings', icon: Brain, label: 'Learnings' },
    ],
  },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const { project, sidebarCollapsed, setSidebarCollapsed, workflow, skills } = useApp();

  const stages = [
    { id: 'planning', label: 'Planning', icon: LayoutDashboard },
    { id: 'design', label: 'Design', icon: GitBranch },
    { id: 'qa', label: 'Build / QA', icon: Zap },
    { id: 'shipped', label: 'Ship', icon: Rocket },
    { id: 'deployed', label: 'Deploy', icon: Globe },
  ];

  return (
    <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`} style={{ width: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : '240px', minWidth: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : '240px' }}>
      {/* Zone A: Project Identity Strip */}
      <div style={{
        padding: '16px 12px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid var(--color-border-soft)',
        backgroundColor: 'var(--color-surface-soft)'
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, backgroundColor: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 800, fontSize: 14, flexShrink: 0,
        }}>D</div>
        {!sidebarCollapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--color-text-primary)' }}>{project.name}</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <GitBranch size={10} /> main
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* DSTACK Primary Action */}
        <div style={{ padding: '12px 8px' }}>
          <Link href="/dstack" className={`sidebar-item${pathname === '/dstack' ? ' active' : ''}`} 
            style={{ 
              padding: '10px 14px',
              backgroundColor: pathname === '/dstack' ? 'var(--color-primary-soft)' : 'var(--color-surface)',
              border: `1px solid ${pathname === '/dstack' ? 'var(--color-primary-soft)' : 'var(--color-border-soft)'}`,
              boxShadow: 'var(--shadow-sm)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 20
            }}
          >
            <Terminal size={18} style={{ color: pathname === '/dstack' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
            {!sidebarCollapsed && <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.04em', color: pathname === '/dstack' ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>DSTACK SHELL</span>}
          </Link>

          {/* Zone B: Workflow Stage Tracker */}
          {!sidebarCollapsed && (
            <div style={{ marginBottom: 24, padding: '0 4px' }}>
              <div className="sidebar-section-label" style={{ marginBottom: 12 }}>Workflow Progress</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>
                <div style={{ position: 'absolute', left: 7, top: 10, bottom: 10, width: 1, backgroundColor: 'var(--color-border-soft)' }} />
                {stages.map((stage, idx) => {
                  const isActive = workflow.currentStage === stage.id;
                  const isComplete = idx < stages.findIndex(s => s.id === workflow.currentStage);
                  return (
                    <div key={stage.id} style={{ 
                      display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', 
                      opacity: isComplete || isActive ? 1 : 0.5,
                      borderLeft: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                      paddingLeft: isActive ? 10 : 12,
                      marginLeft: isActive ? -12 : 0,
                    }}>
                      <div style={{ 
                        width: 11, height: 11, borderRadius: '50%', 
                        backgroundColor: isActive ? 'var(--color-primary)' : isComplete ? 'var(--color-success)' : 'var(--color-border)',
                        border: '2px solid var(--color-surface)',
                        zIndex: 1, flexShrink: 0
                      }} />
                      <div style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                        {stage.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Zone C: Navigation */}
          <div className="sidebar-section">
            {!sidebarCollapsed && <div className="sidebar-section-label">Navigation</div>}
            <Link href="/dashboard" className={`sidebar-item${pathname === '/dashboard' ? ' active' : ''}`}>
              <LayoutDashboard size={18} />
              {!sidebarCollapsed && <span>Dashboard</span>}
            </Link>
            <Link href="/workflow" className={`sidebar-item${pathname === '/workflow' ? ' active' : ''}`}>
              <GitBranch size={18} />
              {!sidebarCollapsed && <span>Workflow</span>}
            </Link>
            <Link href="/skills" className={`sidebar-item${pathname === '/skills' ? ' active' : ''}`}>
              <Zap size={18} />
              {!sidebarCollapsed && <span>Skills Library</span>}
            </Link>
            <Link href="/runs" className={`sidebar-item${pathname === '/runs' ? ' active' : ''}`}>
              <History size={18} />
              {!sidebarCollapsed && <span>Run History</span>}
            </Link>
            <Link href="/artifacts" className={`sidebar-item${pathname === '/artifacts' ? ' active' : ''}`}>
              <Box size={18} />
              {!sidebarCollapsed && <span>Artifacts</span>}
            </Link>
            <Link href="/browser" className={`sidebar-item${pathname === '/browser' ? ' active' : ''}`}>
              <Globe size={18} />
              {!sidebarCollapsed && <span>Browser / QA</span>}
            </Link>
            <Link href="/deploy" className={`sidebar-item${pathname === '/deploy' ? ' active' : ''}`}>
              <Rocket size={18} />
              {!sidebarCollapsed && <span>Deploy</span>}
            </Link>
          </div>

          </div>
        </div>

      {/* Zone D: System Status Footer */}
      <div style={{
        padding: '12px', borderTop: '1px solid var(--color-border-soft)',
        display: 'flex', flexDirection: 'column', gap: 8,
        backgroundColor: 'var(--color-surface-soft)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--color-text-tertiary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
            <Cpu size={12} /> {project.provider.current === 'gemini' ? 'PRO' : 'FLASH'}
          </div>
          <span>•</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: project.safetyMode.mode === 'NORMAL' ? 'var(--color-success)' : 'var(--color-warning)' }}>
            <Shield size={12} /> {project.safetyMode.mode}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/settings" className={`sidebar-item${pathname === '/settings' ? ' active' : ''}`}
            style={{ padding: '6px 8px', flex: sidebarCollapsed ? 1 : undefined }}>
            <Settings size={16} />
            {!sidebarCollapsed && <span style={{ fontSize: 12 }}>Settings</span>}
          </Link>
          {!sidebarCollapsed && (
            <button className="btn-ghost" onClick={() => setSidebarCollapsed(true)}
              suppressHydrationWarning
              style={{ padding: 4, borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: 'none', color: 'var(--color-text-muted)' }}>
              <ChevronLeft size={16} />
            </button>
          )}
          {sidebarCollapsed && (
            <button className="btn-ghost" onClick={() => setSidebarCollapsed(false)}
              suppressHydrationWarning
              style={{ padding: 4, borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: 'none', color: 'var(--color-text-muted)' }}>
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
