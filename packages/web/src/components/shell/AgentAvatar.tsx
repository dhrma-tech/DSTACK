'use client';

import React from 'react';
import type { AgentPersona } from '@dstack/shared';

const AGENT_COLORS: Record<AgentPersona, { bg: string; fg: string; label: string }> = {
  CEO: { bg: '#ede9fe', fg: '#7c3aed', label: 'CEO' },
  PM: { bg: '#dbeafe', fg: '#2563eb', label: 'PM' },
  DESIGNER: { bg: '#fce7f3', fg: '#db2777', label: 'DS' },
  DEVELOPER: { bg: '#ccfbf1', fg: '#0f766e', label: 'DV' },
  QA: { bg: '#fef3c7', fg: '#d97706', label: 'QA' },
  CSO: { bg: '#fee2e2', fg: '#dc2626', label: 'CS' },
  SECURITY: { bg: '#fee2e2', fg: '#b91c1c', label: 'SE' },
  HUMAN: { bg: '#f5f5f5', fg: '#525252', label: 'HU' },
  SYSTEM: { bg: '#e5e5e5', fg: '#404040', label: 'SY' }
};

export function agentColor(agent: AgentPersona): { bg: string; fg: string; label: string } {
  return AGENT_COLORS[agent];
}

export default function AgentAvatar({ agent, size = 32 }: { agent: AgentPersona; size?: number }) {
  const color = agentColor(agent);
  return (
    <div
      title={agent}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: color.bg,
        color: color.fg,
        fontSize: Math.max(10, size * 0.32),
        fontWeight: 800,
        border: `2px solid ${color.fg}22`,
        flex: '0 0 auto'
      }}
    >
      {color.label}
    </div>
  );
}
