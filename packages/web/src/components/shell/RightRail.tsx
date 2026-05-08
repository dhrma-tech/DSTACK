'use client';

import { useState } from 'react';
import { GitBranch, FileText, List } from 'lucide-react';
import WorkflowRail from './rails/WorkflowRail';
import ArtifactRail from './rails/ArtifactRail';
import LogRail from './rails/LogRail';
import type { ShellEvent } from '@/lib/api';

type Tab = 'workflow' | 'artifact' | 'log';

interface RightRailProps {
  events: ShellEvent[];
  selectedArtifact?: string | null;
  onSelectArtifact?: (skillName: string) => void;
}

const TABS: { id: Tab; icon: React.FC<{ size?: number }>; label: string }[] = [
  { id: 'workflow', icon: GitBranch, label: 'Workflow' },
  { id: 'artifact', icon: FileText,  label: 'Artifact' },
  { id: 'log',      icon: List,      label: 'Log' },
];

export default function RightRail({ events, selectedArtifact, onSelectArtifact }: RightRailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('workflow');

  // Auto-switch to artifact tab when a skill is selected
  const handleSelectSkill = (skillName: string) => {
    onSelectArtifact?.(skillName);
    setActiveTab('artifact');
  };

  return (
    <div style={{
      width: 320, flexShrink: 0, background: '#ffffff',
      borderLeft: '1px solid var(--hairline)',
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      {/* Tab bar */}
      <div style={{ height: 40, display: 'flex', borderBottom: '1px solid var(--hairline)', flexShrink: 0 }}>
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              flex: 1, height: '100%', border: 'none', cursor: 'pointer',
              background: 'transparent', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 1,
              borderBottom: activeTab === id ? '2px solid var(--coral)' : '2px solid transparent',
              color: activeTab === id ? 'var(--ink)' : 'var(--muted)',
            }}
          >
            <Icon size={14} />
            <span style={{ fontSize: 9, fontWeight: 500 }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'workflow' && <WorkflowRail onSelectSkill={handleSelectSkill} />}
        {activeTab === 'artifact' && <ArtifactRail selectedSkill={selectedArtifact} />}
        {activeTab === 'log'      && <LogRail events={events} />}
      </div>
    </div>
  );
}
