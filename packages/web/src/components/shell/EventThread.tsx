'use client';

import { useRef, useEffect } from 'react';
import type { ShellEvent } from '@/lib/api';
import ReasoningBlock from './events/ReasoningBlock';
import ToolCallCard from './events/ToolCallCard';
import ApprovalGateCard from './events/ApprovalGateCard';
import ArtifactSaveCard from './events/ArtifactSaveCard';
import SkillCompleteCard from './events/SkillCompleteCard';

interface EventThreadProps {
  events: ShellEvent[];
  isRunning?: boolean;
  currentSkill?: string | null;
  onApproval: (decision: 'approve' | 'deny') => void;
  onViewArtifact?: (skillName: string) => void;
  onRunSkill?: (skillName: string) => void;
}

export default function EventThread({
  events,
  isRunning,
  currentSkill,
  onApproval,
  onViewArtifact,
  onRunSkill,
}: EventThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  if (events.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 16 }}>
          <path d="M24 4L42 14V34L24 44L6 34V14L24 4Z" stroke="var(--coral)" strokeWidth="2" fill="none"/>
          <path d="M24 12L24 36M18 18L30 30M30 18L18 30" stroke="var(--coral)" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: 'var(--ink)', marginBottom: 8 }}>
          Run a skill to begin
        </h2>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>
          Press ⌘K or click a skill in the sidebar
        </p>
      </div>
    );
  }

  // Pair tool-calls with their results
  const toolResults = new Map<string, Extract<ShellEvent, { type: 'tool-result' }>>();
  const responded = new Set<string>();

  for (const ev of events) {
    if (ev.type === 'tool-result') {
      toolResults.set(ev.toolName, ev);
    }
  }

  // Detect which approval-required events have been resolved
  let lastApprovalIdx = -1;
  let foundPostApprovalToolCall = false;
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.type === 'tool-result' && lastApprovalIdx !== -1) { foundPostApprovalToolCall = true; }
    if (ev.type === 'approval-required') {
      if (foundPostApprovalToolCall) responded.add(`${i}`);
      lastApprovalIdx = i;
      foundPostApprovalToolCall = false;
    }
  }

  // Collapse consecutive reasoning into groups
  type DisplayEvent =
    | { kind: 'reasoning'; text: string; key: string }
    | { kind: 'tool-call'; ev: Extract<ShellEvent, { type: 'tool-call' }>; key: string }
    | { kind: 'approval'; ev: Extract<ShellEvent, { type: 'approval-required' }>; resolved: boolean; key: string }
    | { kind: 'artifact'; ev: Extract<ShellEvent, { type: 'artifact-saved' }>; key: string }
    | { kind: 'complete'; ev: Extract<ShellEvent, { type: 'complete' }>; key: string }
    | { kind: 'error'; ev: Extract<ShellEvent, { type: 'error' }>; key: string };

  const display: DisplayEvent[] = [];
  let reasoningBuf: string[] = [];
  let reasoningKey = '';

  const flushReasoning = () => {
    if (reasoningBuf.length > 0) {
      display.push({ kind: 'reasoning', text: reasoningBuf.join('\n'), key: reasoningKey });
      reasoningBuf = [];
      reasoningKey = '';
    }
  };

  events.forEach((ev, i) => {
    if (ev.type === 'reasoning') {
      if (reasoningBuf.length === 0) reasoningKey = `r-${i}`;
      reasoningBuf.push(ev.text);
    } else if (ev.type === 'tool-result') {
      // tool-results are paired with tool-calls, skip as standalone
    } else {
      flushReasoning();
      if (ev.type === 'tool-call') {
        display.push({ kind: 'tool-call', ev, key: `tc-${i}` });
      } else if (ev.type === 'approval-required') {
        display.push({ kind: 'approval', ev, resolved: responded.has(`${i}`), key: `ap-${i}` });
      } else if (ev.type === 'artifact-saved') {
        display.push({ kind: 'artifact', ev, key: `art-${i}` });
      } else if (ev.type === 'complete') {
        display.push({ kind: 'complete', ev, key: `done-${i}` });
      } else if (ev.type === 'error') {
        display.push({ kind: 'error', ev, key: `err-${i}` });
      }
    }
  });
  flushReasoning();

  const pendingApproval = display.find(d => d.kind === 'approval' && !d.resolved);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {display.map((item) => {
        const isBeforePending = pendingApproval && display.indexOf(item) < display.indexOf(pendingApproval);
        const dimmed = !!isBeforePending && item !== pendingApproval;

        return (
          <div
            key={item.key}
            style={{ opacity: dimmed ? 0.5 : 1, pointerEvents: dimmed ? 'none' : 'auto', transition: 'opacity 0.2s' }}
          >
            {item.kind === 'reasoning' && (
              <ReasoningBlock text={item.text} isRunning={isRunning} />
            )}
            {item.kind === 'tool-call' && (
              <ToolCallCard
                toolName={item.ev.toolName}
                args={item.ev.args}
                gateDecision={item.ev.gateDecision}
                result={toolResults.get(item.ev.toolName) ?? null}
              />
            )}
            {item.kind === 'approval' && (
              <ApprovalGateCard
                toolName={item.ev.toolName}
                description={item.ev.description}
                permissionLevel={item.ev.permissionLevel}
                args={item.ev.args}
                onRespond={onApproval}
                status={item.resolved ? 'approved' : 'pending'}
              />
            )}
            {item.kind === 'artifact' && (
              <ArtifactSaveCard
                skillName={item.ev.skillName}
                verdict={item.ev.verdict}
                timestamp={item.ev.timestamp}
                path={item.ev.path}
                onView={onViewArtifact}
              />
            )}
            {item.kind === 'complete' && (item.ev.verdict === 'FAIL' || item.ev.verdict === 'REVISE') && (
              <SkillCompleteCard
                skillName={item.ev.skillName}
                verdict={item.ev.verdict as 'FAIL' | 'REVISE'}
                durationMs={item.ev.durationMs}
                onRunSuggested={onRunSkill}
              />
            )}
            {item.kind === 'error' && (
              <div style={{ background: '#fdecea', border: '1px solid #f0b0b0', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--error)' }}>
                <strong>Error:</strong> {item.ev.message}
              </div>
            )}
          </div>
        );
      })}

      {/* Running indicator */}
      {isRunning && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: 13, color: 'var(--coral)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--coral)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
          {currentSkill ? `Executing /${currentSkill}…` : 'Running…'}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
