'use client';

import { type ReactNode } from 'react';
import Topbar from './layout/Topbar';
import Sidebar from './layout/Sidebar';
import StatusBar from './layout/StatusBar';

interface AppShellProps {
  children: ReactNode;
  isRunning?: boolean;
  currentSkill?: string | null;
  lastArtifactPath?: string | null;
  // Legacy props kept for compat
  breadcrumbs?: { label: string; href?: string }[];
  pageTitle?: string;
  actions?: ReactNode;
}

export default function AppShell({
  children,
  isRunning,
  currentSkill,
  lastArtifactPath,
}: AppShellProps) {
  return (
    <div style={{ height: '100vh', background: 'var(--canvas)' }}>
      <Topbar />
      <Sidebar />
      <main style={{
        marginLeft: 'var(--sidebar-width)',
        marginTop: 'var(--topbar-height)',
        marginBottom: 'var(--statusbar-height)',
        height: 'calc(100vh - var(--topbar-height) - var(--statusbar-height))',
        overflow: 'hidden',
        background: 'var(--canvas)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {children}
      </main>
      <StatusBar isRunning={isRunning} currentSkill={currentSkill} lastArtifactPath={lastArtifactPath} />
    </div>
  );
}
