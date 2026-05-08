'use client';

import React from 'react';
import type { AgentEvent } from '@dstack/shared';
import ReasoningBlock from './events/ReasoningBlock';
import ToolCallCard from './events/ToolCallCard';
import ApprovalGateCard from './events/ApprovalGateCard';
import ArtifactSaveCard from './events/ArtifactSaveCard';
import AgentAvatar from './AgentAvatar';
import CodeWindow from '../CodeWindow';

interface EventThreadProps {
  events: AgentEvent[];
  onApproval: (decision: 'approve' | 'deny') => void;
}

export default function EventThread({ events, onApproval }: EventThreadProps) {
  return (
    <div style={{ width: '100%', maxWidth: 760 }}>
      {events.map((event) => {
        switch (event.type) {
          case 'agent_started':
            return (
              <div key={event.id} className="card" style={{ padding: 14, marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                <AgentAvatar agent={event.agent} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{event.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{event.message}</div>
                </div>
              </div>
            );
          case 'reasoning_trace':
            return <ReasoningBlock key={event.id} steps={event.steps} activeStep={event.activeStep} agent={event.agent} />;
          case 'tool_call':
            return <ToolCallCard key={event.id} toolName={event.toolName} args={event.args} status="pending" />;
          case 'tool_result':
            return <ToolCallCard key={event.id} toolName={event.toolCallId} args={{}} status={event.success ? 'success' : 'error'} result={{ success: event.success, stdout: event.stdout, stderr: event.stderr, code: event.code }} />;
          case 'approval_required':
            return <ApprovalGateCard key={event.id} gate={event.gate} onRespond={onApproval} />;
          case 'artifact_saved':
            return <ArtifactSaveCard key={event.id} skillName={event.skillName} verdict={event.verdict ?? 'PASS'} path={event.artifactPath} />;
          case 'file_patch':
            return <div key={event.id} style={{ marginBottom: 16 }}><CodeWindow title={event.patch.filePath} code={event.patch.after ?? ''} diffRows={event.patch.diff} /></div>;
          case 'preview_ready':
            return (
              <div key={event.id} className="card" style={{ padding: 14, marginBottom: 14 }}>
                <strong>Preview ready:</strong> <a href={event.previewUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>{event.previewUrl}</a>
              </div>
            );
          case 'visual_qa_result':
            return (
              <div key={event.id} className="card" style={{ padding: 14, marginBottom: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Visual QA</div>
                {event.findings.map((finding) => (
                  <div key={finding.id} style={{ fontSize: 13, marginBottom: 8 }}>
                    <strong>{finding.severity}</strong> {finding.description}
                    <div style={{ color: 'var(--color-text-tertiary)' }}>{finding.recommendedFix}</div>
                  </div>
                ))}
              </div>
            );
          case 'workflow_stalled':
            return (
              <div key={event.id} className="card" style={{ padding: 14, marginBottom: 14, borderColor: 'var(--color-error)' }}>
                <strong>Conflict Resolution Required</strong>
                <p style={{ fontSize: 13 }}>{event.stalled.reason}</p>
                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{event.stalled.recommendedHumanAction}</p>
              </div>
            );
          case 'run_complete':
            return <div key={event.id} className="card" style={{ padding: 14, marginBottom: 14, borderColor: 'var(--color-success)' }}><strong>Run complete:</strong> {event.summary}</div>;
          case 'run_error':
            return <div key={event.id} className="card" style={{ padding: 14, marginBottom: 14, borderColor: 'var(--color-error)', color: 'var(--color-error)' }}><strong>Error:</strong> {event.message}</div>;
        }
      })}
    </div>
  );
}
