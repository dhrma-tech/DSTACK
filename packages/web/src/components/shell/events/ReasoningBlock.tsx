'use client';

import React from 'react';

export default function ReasoningBlock({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 13,
      lineHeight: 1.6,
      color: 'var(--color-text-tertiary)',
      fontStyle: 'italic',
      marginBottom: 16,
      paddingLeft: 12,
      borderLeft: '2px solid var(--color-border-soft)',
      whiteSpace: 'pre-wrap'
    }}>
      {text}
    </div>
  );
}
