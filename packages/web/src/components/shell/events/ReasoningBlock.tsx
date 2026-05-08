'use client';

<<<<<<< Updated upstream
import React from 'react';
import { motion } from 'framer-motion';
import type { AgentPersona } from '@dstack/shared';
import AgentAvatar from '../AgentAvatar';

export default function ReasoningBlock({ steps, activeStep = 0, agent = 'SYSTEM' }: { steps: string[]; activeStep?: number; agent?: AgentPersona }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start' }}
    >
      <AgentAvatar agent={agent} size={28} />
      <div style={{
        flex: 1,
        fontSize: 12,
        lineHeight: 1.65,
        color: 'var(--color-text-tertiary)',
        padding: '10px 12px',
        border: '1px solid var(--color-border-soft)',
        borderRadius: 8,
        background: 'var(--color-surface)',
        fontFamily: 'var(--font-mono)'
      }}>
        {steps.map((step, index) => (
          <motion.div
            key={`${step}-${index}`}
            animate={index === activeStep ? { opacity: [0.45, 1, 0.45] } : { opacity: 0.72 }}
            transition={index === activeStep ? { duration: 1.4, repeat: Infinity } : { duration: 0.2 }}
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {step.startsWith('>') ? step : `> ${step}`}
          </motion.div>
        ))}
      </div>
    </motion.div>
=======
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
>>>>>>> Stashed changes
  );
}
