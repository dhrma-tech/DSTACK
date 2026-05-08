'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface CodeWindowProps {
  title?: string;
  code: string;
  diffRows?: Array<{ kind: 'context' | 'add' | 'delete'; lineNumber: number; text: string }>;
}

const CodeWindow: React.FC<CodeWindowProps> = ({ title = "terminal", code, diffRows }) => {
  const rows = diffRows ?? code.split('\n').map((text, index) => ({ kind: 'context' as const, lineNumber: index + 1, text }));
  return (
    <div className="code-window">
      <div className="code-header">
        <div className="dot" style={{ backgroundColor: '#ff5f56' }}></div>
        <div className="dot" style={{ backgroundColor: '#ffbd2e' }}></div>
        <div className="dot" style={{ backgroundColor: '#27c93f' }}></div>
        <span style={{ 
          marginLeft: '8px', 
          fontSize: '12px', 
          color: 'var(--color-text-tertiary)',
          fontWeight: 500,
          fontFamily: 'var(--font-sans)'
        }}>{title}</span>
      </div>
      <div className="code-content">
        <pre style={{ margin: 0 }}>
          <code>
            {rows.map((row, i) => (
              <motion.div
                key={`${row.lineNumber}-${i}-${row.text}`}
                initial={row.kind === 'add' ? { backgroundColor: 'rgba(16,185,129,0.32)' } : row.kind === 'delete' ? { backgroundColor: 'rgba(239,68,68,0.22)', opacity: 1 } : false}
                animate={row.kind === 'add' ? { backgroundColor: 'rgba(16,185,129,0)' } : row.kind === 'delete' ? { backgroundColor: 'rgba(239,68,68,0.05)', opacity: 0.72 } : {}}
                transition={{ duration: row.kind === 'add' ? 1.5 : 0.5 }}
                style={{ display: 'flex', gap: '16px', textDecoration: row.kind === 'delete' ? 'line-through' : 'none', color: row.kind === 'add' ? 'var(--color-success)' : row.kind === 'delete' ? 'var(--color-error)' : undefined }}
              >
                <span style={{ 
                  color: 'var(--color-text-muted)', 
                  width: '20px', 
                  textAlign: 'right', 
                  userSelect: 'none' 
                }}>{row.lineNumber}</span>
                <span style={{ color: row.text.trim().startsWith('$') ? 'var(--color-primary)' : 'inherit' }}>
                  {row.kind === 'add' ? '+ ' : row.kind === 'delete' ? '- ' : '  '}{row.text}
                </span>
              </motion.div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
};

export default CodeWindow;

