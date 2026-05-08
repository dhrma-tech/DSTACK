'use client';

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
  );
}
