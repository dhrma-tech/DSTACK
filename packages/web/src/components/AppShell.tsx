'use client';

import React, { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import { useApp } from '@/lib/app-context';
import { ChevronRight, Shield, Snowflake } from 'lucide-react';

interface AppShellProps {
  children: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  pageTitle?: string;
  actions?: ReactNode;
}

export default function AppShell({ children, breadcrumbs, pageTitle, actions }: AppShellProps) {
  const { project } = useApp();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <AppSidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Safety / Freeze Banners */}
        {project.safetyMode.mode !== 'NORMAL' && (
          <div style={{
            padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontWeight: 600,
            backgroundColor: project.safetyMode.mode === 'GUARD' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
            color: project.safetyMode.mode === 'GUARD' ? 'var(--color-error)' : 'var(--color-warning)',
            borderBottom: '1px solid var(--color-border-soft)',
          }}>
            <Shield size={14} />
            Safety Mode: {project.safetyMode.mode}
            {project.safetyMode.reason && <span style={{ fontWeight: 400 }}>— {project.safetyMode.reason}</span>}
          </div>
        )}
        {project.freezeState.frozen && (
          <div style={{
            padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontWeight: 600,
            backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-error)',
            borderBottom: '1px solid var(--color-border-soft)',
          }}>
            <Snowflake size={14} />
            Deploys Frozen
            {project.freezeState.reason && <span style={{ fontWeight: 400 }}>— {project.freezeState.reason}</span>}
          </div>
        )}

        {/* Top Bar */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {breadcrumbs && breadcrumbs.length > 0 && (
              <div className="breadcrumb">
                {breadcrumbs.map((bc, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <ChevronRight size={12} />}
                    {i === breadcrumbs.length - 1
                      ? <span className="breadcrumb-current">{bc.label}</span>
                      : <a href={bc.href || '#'} style={{ color: 'var(--color-text-tertiary)' }}>{bc.label}</a>
                    }
                  </React.Fragment>
                ))}
              </div>
            )}
            {!breadcrumbs && pageTitle && (
              <span style={{ fontWeight: 600, fontSize: 14 }}>{pageTitle}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {actions}
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{project.name}</span>
          </div>
        </div>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--color-canvas)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
