'use client';

import React from 'react';
import ReasoningBlock from './events/ReasoningBlock';
import ToolCallCard from './events/ToolCallCard';
import ApprovalGateCard from './events/ApprovalGateCard';
import ArtifactSaveCard from './events/ArtifactSaveCard';

interface EventThreadProps {
  events: any[];
  onApproval: (decision: 'approve' | 'deny') => void;
}

export default function EventThread({ events, onApproval }: EventThreadProps) {
  // Group tool-calls with their results
  const renderedEvents = [];
  const toolResults = new Map<string, any>();
  
  // Find results first
  for (const event of events) {
    if (event.type === 'tool-result') {
      toolResults.set(event.toolName, event);
    }
  }

  const finalEvents = [];
  let currentReasoning = [];

  for (const event of events) {
    if (event.type === 'reasoning') {
      currentReasoning.push(event.text);
    } else {
      if (currentReasoning.length > 0) {
        finalEvents.push({ type: 'reasoning-group', texts: [...currentReasoning] });
        currentReasoning = [];
      }
      finalEvents.push(event);
    }
  }
  if (currentReasoning.length > 0) {
    finalEvents.push({ type: 'reasoning-group', texts: currentReasoning });
  }

  let i = 0;
  for (const event of finalEvents) {
    if (event.type === 'reasoning-group') {
      renderedEvents.push(<ReasoningBlock key={`e-${i}`} text={event.texts.join('\n')} />);
    } else if (event.type === 'tool-call') {
      renderedEvents.push(
        <ToolCallCard
          key={`e-${i}`}
          toolName={event.toolName}
          args={event.args}
          status={toolResults.has(event.toolName) ? (toolResults.get(event.toolName).success ? 'success' : 'error') : 'pending'}
          result={toolResults.get(event.toolName)}
        />
      );
    } else if (event.type === 'approval-required') {
      // Find if we have a reasoning event after this in the ORIGINAL events that says "Approval decision sent"
      // Or just look for any event that would indicate we've moved past it.
      // For now, keep it simple.
      renderedEvents.push(
        <ApprovalGateCard
          key={`e-${i}`}
          description={event.description}
          onRespond={onApproval}
        />
      );
    } else if (event.type === 'artifact-saved') {
      renderedEvents.push(
        <ArtifactSaveCard
          key={`e-${i}`}
          skillName={event.skillName}
          verdict={event.verdict}
          path={event.path}
        />
      );
    } else if (event.type === 'error') {
       renderedEvents.push(
        <div key={`e-${i}`} className="card" style={{ border: '1px solid var(--color-error)', backgroundColor: 'rgba(239,68,68,0.02)', padding: 12, marginBottom: 16, color: 'var(--color-error)', fontSize: 13 }}>
          <strong>Error:</strong> {event.message || JSON.stringify(event)}
        </div>
      );
    }
    i++;
  }

  return (
    <div style={{ width: '100%', maxWidth: 720 }}>
      {renderedEvents}
    </div>
  );
}
