'use client';

import React from 'react';
import Link from 'next/link';
import { GitBranch, Shield } from 'lucide-react';
import { useApp } from '@/lib/app-context';

const STAGES = ['planning', 'design', 'build/qa', 'ship', 'deploy'] as const;

function StagePill({ label, status }: { label: string; status: 'done' | 'current' | 'future' }) {
  const styles: Record<string, React.CSSProperties> = {
    done:    { background: '#edf7ee', color: '#2e7d32',      border: '1px solid #b2d9b5' },
    current: { background: 'var(--coral-bg)', color: 'var(--coral)', border: '1px solid #f0c4b3' },
    future:  { background: 'var(--canvas)',   color: 'var(--muted)', border: '1px solid var(--hairline)' },
  };
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, padding: '3px 10px', borderRadius: 10,
      ...styles[status],
    }}>
      {label}
    </span>
  );
}

const STAGE_MAP: Record<string, number> = {
  planning: 0, design: 1, 'build/qa': 2, qa: 2, ship: 3, shipped: 3, deploy: 4, deployed: 4,
};

export default function Topbar() {
  const { project } = useApp();

  const currentIdx = STAGE_MAP[project.workflowStage ?? 'planning'] ?? 0;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--topbar-height)',
      background: 'var(--canvas)', borderBottom: '1px solid var(--hairline)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', zIndex: 50, gap: 12,
    }}>
      {/* Left — logo + project name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {/* Spike mark */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L14 5V11L8 15L2 11V5L8 1Z" stroke="var(--coral)" strokeWidth="1.5" fill="none"/>
          <path d="M8 4L8 12M5 6.5L11 9.5M11 6.5L5 9.5" stroke="var(--coral)" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <Link href="/dashboard" style={{
          fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 14, color: 'var(--ink)',
        }}>
          DStack
        </Link>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>/</span>
        <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.name}
        </span>
      </div>

      {/* Center — stage pipeline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        {STAGES.map((stage, i) => (
          <React.Fragment key={stage}>
            <StagePill
              label={stage}
              status={i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'future'}
            />
            {i < STAGES.length - 1 && (
              <span style={{ color: 'var(--hairline)', fontSize: 10, userSelect: 'none' }}>›</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Right — git info + safety + provider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <GitBranch size={11} />
          main
        </span>

        {/* Safety mode badge */}
        {project.safetyMode.mode !== 'NORMAL' && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px',
            borderRadius: 9999, fontFamily: 'var(--font-mono)', fontWeight: 500,
            background: project.safetyMode.mode === 'GUARD' ? '#fdecea' : '#fff8e8',
            color: project.safetyMode.mode === 'GUARD' ? 'var(--error)' : '#7d5200',
            border: `1px solid ${project.safetyMode.mode === 'GUARD' ? '#f0b0b0' : '#e8c97a'}`,
          }}>
            <Shield size={10} />
            {project.safetyMode.mode}
          </span>
        )}

        {/* Provider badge */}
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 9999,
          fontFamily: 'var(--font-mono)', fontWeight: 500,
          background: project.provider.current === 'fake' ? '#fff8e8' : '#edf7ee',
          color: project.provider.current === 'fake' ? '#7d5200' : '#2e7d32',
          border: `1px solid ${project.provider.current === 'fake' ? '#e8c97a' : '#b2d9b5'}`,
        }}>
          {project.provider.current === 'fake' ? 'FAKE' : '● Live'}
        </span>
      </div>
    </div>
  );
}
