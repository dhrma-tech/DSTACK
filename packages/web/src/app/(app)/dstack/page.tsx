'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import EventThread from '@/components/shell/EventThread';
import CommandInput from '@/components/shell/CommandInput';
import RightRail from '@/components/shell/RightRail';
import UserCommandCard from '@/components/shell/events/UserCommandCard';
import CommandPalette from '@/components/CommandPalette';
import { useActiveRun } from '@/hooks/useActiveRun';
import { useSuggestions } from '@/hooks/useSuggestions';
import { useApp } from '@/lib/app-context';
import type { ShellEvent } from '@/lib/api';
import SuggestionBanner from '@/components/SuggestionBanner';

export default function DstackPage() {
  const { skills, project } = useApp();
  const { events, isRunning, currentSkill, startRun, stopRun, respondToApproval, verdict } = useActiveRun();
  const { suggestions, loading: suggestionsLoading } = useSuggestions(events.length);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const [userCommands, setUserCommands] = useState<Array<{ skillName: string; timestamp: string }>>([]);

  // Build display events: prepend user command card events
  const allEvents: ShellEvent[] = [
    // We show UserCommandCard separately before the thread events
    ...events,
  ];

  const lastArtifactPath = events.findLast(e => e.type === 'artifact-saved')?.type === 'artifact-saved'
    ? (events.findLast(e => e.type === 'artifact-saved') as Extract<ShellEvent, { type: 'artifact-saved' }>).path
    : null;

  const handleRun = async (skillName: string, inputs: Record<string, string>, flags: { dryRun: boolean; force: boolean; model: string }) => {
    setUserCommands(prev => [...prev, { skillName, timestamp: new Date().toISOString() }]);
    await startRun(skillName, inputs, { dryRun: flags.dryRun, force: flags.force });
  };

  const handleViewArtifact = (skillName: string) => {
    setSelectedArtifact(skillName);
  };

  const isGuard = project.safetyMode.mode === 'GUARD';
  const toolCallCount = events.filter(e => e.type === 'tool-call').length;

  return (
    <AppShell isRunning={isRunning} currentSkill={currentSkill} lastArtifactPath={lastArtifactPath}>
      {/* Mode banners */}
      {isGuard && (
        <div style={{ background: '#fdecea', borderBottom: '1px solid #f0b0b0', padding: '5px 16px', fontSize: 11, color: 'var(--error)', fontWeight: 500 }}>
          🛡 GUARD MODE ACTIVE — writes and execute commands are blocked
        </div>
      )}
      {project.provider.current === 'fake' && (
        <div style={{ borderTop: '2px solid var(--amber)', background: '#fff8e8', padding: '5px 16px', fontSize: 11, color: '#7d5200', fontWeight: 500 }}>
          ⚠ FAKE PROVIDER MODE — execution results are simulated
        </div>
      )}

      {/* Three-column layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Center column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Suggestion banner */}
          {!isRunning && events.length === 0 && (
            <SuggestionBanner
              suggestions={suggestions}
              loading={suggestionsLoading}
              onRunSkill={(name) => handleRun(name, {}, { dryRun: false, force: false, model: 'flash' })}
            />
          )}
          {!isRunning && events.length > 0 && suggestions.length > 0 && (
            <SuggestionBanner
              suggestions={suggestions}
              loading={suggestionsLoading}
              onRunSkill={(name) => handleRun(name, {}, { dryRun: false, force: false, model: 'flash' })}
              compact
            />
          )}
          {/* Scrollable event thread */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* User command banners at top */}
            {userCommands.length > 0 && (
              <div style={{ padding: '16px 16px 0' }}>
                <UserCommandCard
                  skillName={userCommands[userCommands.length - 1].skillName}
                  timestamp={new Date(userCommands[userCommands.length - 1].timestamp).toLocaleTimeString()}
                />
              </div>
            )}
            <EventThread
              events={allEvents}
              isRunning={isRunning}
              currentSkill={currentSkill}
              onApproval={respondToApproval}
              onViewArtifact={handleViewArtifact}
              onRunSkill={(name) => handleRun(name, {}, { dryRun: false, force: false, model: 'flash' })}
            />
          </div>

          {/* Docked command input */}
          <CommandInput
            skills={Array.isArray(skills) ? skills.map(s => ({
              name: s.name,
              command: s.command,
              description: s.description,
              stage: s.stage,
              model: s.model,
              maturity: s.maturity as 'complete' | 'partial' | 'experimental',
              available: s.available,
              hasLatestArtifact: s.hasLatestArtifact,
              lastRunAt: s.lastRunAt,
              lastVerdict: null,
              isBlocked: !s.available,
              requiresArtifacts: s.requiresArtifacts,
              allowedTools: s.allowedTools,
              nextSkill: s.nextSkill,
            })) : []}
            suggestions={suggestions}
            isRunning={isRunning}
            currentSkill={currentSkill}
            toolCallCount={toolCallCount}
            onRun={handleRun}
            onStop={stopRun}
            disabled={isGuard}
          />
        </div>

        {/* Right rail */}
        <RightRail
          events={allEvents}
          selectedArtifact={selectedArtifact}
          onSelectArtifact={setSelectedArtifact}
        />
      </div>

      {/* Command palette */}
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelectSkill={() => {
          setPaletteOpen(false);
        }}
      />
    </AppShell>
  );
}
