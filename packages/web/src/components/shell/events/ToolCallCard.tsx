'use client';

import React from 'react';
import { Terminal, Check, X, Loader2 } from 'lucide-react';

interface ToolCallCardProps {
  toolName: string;
  args: Record<string, unknown>;
  result?: { output?: unknown; stdout?: string; stderr?: string; code?: number; success?: boolean };
  status: 'pending' | 'success' | 'error';
}

export default function ToolCallCard({ toolName, args, result, status }: ToolCallCardProps) {
  return (
    <div className="card" style={{
      marginBottom: 16,
      borderLeft: `3px solid ${status === 'success' ? 'var(--color-success)' : status === 'error' ? 'var(--color-error)' : 'var(--color-primary)'}`,
      padding: '12px 16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-mono)' }}>
          <Terminal size={14} style={{ color: 'var(--color-text-muted)' }} />
          {toolName}
        </div>
        <div>
          {status === 'pending' && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-primary)' }} />}
          {status === 'success' && <Check size={14} style={{ color: 'var(--color-success)' }} />}
          {status === 'error' && <X size={14} style={{ color: 'var(--color-error)' }} />}
        </div>
      </div>
      
      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', backgroundColor: 'var(--color-surface-soft)', padding: '6px 8px', borderRadius: 4, marginBottom: 8, overflowX: 'auto' }}>
        <pre style={{ margin: 0 }}>{JSON.stringify(args, null, 2)}</pre>
      </div>

      {result && (
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', borderTop: '1px solid var(--color-border-soft)', paddingTop: 8 }}>
           <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formatResult(result)}</pre>
        </div>
      )}
    </div>
  );
}

function formatResult(result: ToolCallCardProps['result']): string {
  if (!result) return '';
  if (typeof result.output === 'string') return result.output;
  if (typeof result.stdout === 'string' || typeof result.stderr === 'string') {
    return [result.stdout, result.stderr].filter(Boolean).join('\n');
  }
  return JSON.stringify(result.output ?? result, null, 2);
}
