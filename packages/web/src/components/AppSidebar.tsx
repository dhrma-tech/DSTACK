'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, GitBranch, Zap, History,
  Box, Globe, Rocket, BarChart3, Brain,
  Settings, ChevronLeft, ChevronRight, Terminal
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
  const { project, sidebarCollapsed, setSidebarCollapsed } = useApp();

  return (
    <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
      {/* Logo */}
      <div style={{
        padding: '16px 12px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid var(--color-border-soft)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, backgroundColor: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0,
        }}>D</div>
        {!sidebarCollapsed && (
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-serif)' }}>DStack</span>
        )}
      </div>

      {/* Nav Sections */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        <Link href="/dstack" className={`sidebar-item${pathname === '/dstack' ? ' active' : ''}`} 
          style={{ 
            marginBottom: 24, 
            padding: '10px 14px',
            backgroundColor: pathname === '/dstack' ? 'var(--color-primary-soft)' : 'var(--color-surface)',
            border: `1px solid ${pathname === '/dstack' ? 'var(--color-primary-soft)' : 'var(--color-border-soft)'}`,
            boxShadow: 'var(--shadow-sm)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <Terminal size={18} style={{ color: pathname === '/dstack' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
          {!sidebarCollapsed && <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.04em', color: pathname === '/dstack' ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>DSTACK</span>}
        </Link>
        {NAV_SECTIONS.map(section => (
          <div key={section.label} className="sidebar-section">
            {!sidebarCollapsed && <div className="sidebar-section-label">{section.label}</div>}
            {section.items.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href} className={`sidebar-item${isActive ? ' active' : ''}`}
                  title={sidebarCollapsed ? item.label : undefined}>
                  <item.icon size={18} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px', borderTop: '1px solid var(--color-border-soft)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Provider Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
          <span className={`status-dot ${project.provider.current === 'gemini' ? 'status-dot-success' : 'status-dot-warning'}`} />
          {!sidebarCollapsed && <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{project.provider.current}</span>}
        </div>

        {/* Settings + Collapse */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/settings" className={`sidebar-item${pathname === '/settings' ? ' active' : ''}`}
            style={{ padding: '6px 8px', flex: sidebarCollapsed ? 1 : undefined }}>
            <Settings size={16} />
            {!sidebarCollapsed && <span>Settings</span>}
          </Link>
          {!sidebarCollapsed && (
            <button className="btn-ghost" onClick={() => setSidebarCollapsed(true)}
              style={{ padding: 4, borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: 'none', color: 'var(--color-text-muted)' }}>
              <ChevronLeft size={16} />
            </button>
          )}
          {sidebarCollapsed && (
            <button className="btn-ghost" onClick={() => setSidebarCollapsed(false)}
              style={{ padding: 4, borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: 'none', color: 'var(--color-text-muted)' }}>
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
