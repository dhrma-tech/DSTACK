'use client';


import { useState } from 'react';
import { ChevronRight, ChevronDown, Brain } from 'lucide-react';

interface ReasoningBlockProps {
  text: string;
  isRunning?: boolean;
}

export default function ReasoningBlock({ text, isRunning }: ReasoningBlockProps) {
  const [expanded, setExpanded] = useState(isRunning ?? true);

  const firstSentence = text.split(/[.!?]\s/)[0] ?? text;
  const chunks = text.split('\n').filter(Boolean);

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--hairline)',
        borderLeft: '2px solid #d4c9bb',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        overflow: 'hidden',
      }}
    >
      {/* Collapsed header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px' }}>
        <Brain size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: expanded ? 'normal' : 'nowrap' }}>
          {expanded ? 'Reasoning' : firstSentence}
        </span>
        {expanded
          ? <ChevronDown size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          : <ChevronRight size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
        }
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 14px 12px' }}>
          {chunks.map((chunk, i) => (
            <p key={i} style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--muted)', lineHeight: 1.7, marginTop: 4, display: 'flex', gap: 6 }}>
              <span style={{ flexShrink: 0, marginTop: 2 }}>•</span>
              <span>{chunk}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
