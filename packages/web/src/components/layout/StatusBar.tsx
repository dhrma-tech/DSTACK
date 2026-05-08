'use client';

import React from 'react';
import { useApp } from '@/lib/app-context';

interface StatusBarProps {
  isRunning?: boolean;
  currentSkill?: string | null;
  lastArtifactPath?: string | null;
}

export default function StatusBar({ isRunning, currentSkill, lastArtifactPath }: StatusBarProps) {
  const { project } = useApp();
  const isFake = project.provider.current === 'fake';
  const isFrozen = project.freezeState.frozen;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 'var(--statusbar-height)',
      background: 'var(--canvas)', borderTop: '1px solid var(--hairline)',
      display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px',
      fontSize: 11, color: 'var(--muted)', zIndex: 50,
    }}>
      {/* Activity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: isRunning ? 'var(--coral)' : 'var(--success)',
          animation: isRunning ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isRunning && currentSkill ? `Running /${currentSkill}…` : 'Idle'}
        </span>
      </div>

      {/* Last artifact */}
      {lastArtifactPath && (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'center', fontSize: 10 }}>
          {lastArtifactPath}
        </span>
      )}

      {/* Right zone */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexShrink: 0 }}>
        {isFake && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: '#fff8e8', color: '#7d5200', border: '1px solid #e8c97a' }}>
            FAKE
          </span>
        )}
        {isFrozen && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--error)', fontWeight: 500 }}>
            🔒 FROZEN
          </span>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted-soft)' }}>
          {project.safetyMode.mode}
        </span>
      </div>
    </div>
  );
}
