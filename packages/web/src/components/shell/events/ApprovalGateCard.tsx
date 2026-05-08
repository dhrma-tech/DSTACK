'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ApprovalGateCardProps {
  runId?: string;
  toolName?: string;
  description: string;
  permissionLevel?: 'READ' | 'WRITE' | 'EXECUTE' | 'DESTRUCTIVE';
  args?: Record<string, unknown>;
  onRespond: (decision: 'approve' | 'deny') => void;
  status?: 'pending' | 'approved' | 'denied';
}

export default function ApprovalGateCard({
  toolName,
  description,
  permissionLevel = 'EXECUTE',
  args,
  onRespond,
  status = 'pending',
}: ApprovalGateCardProps) {
  const isPending = status === 'pending';

  useEffect(() => {
    if (!isPending) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); onRespond('approve'); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); onRespond('deny'); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isPending, onRespond]);

  if (status === 'approved') {
    return (
      <div style={{ background: '#edf7ee', border: '1px solid #b2d9b5', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 8 }}>
        ✓ Action Approved
      </div>
    );
  }
  if (status === 'denied') {
    return (
      <div style={{ background: '#fdecea', border: '1px solid #f0b0b0', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 8 }}>
        ✗ Action Denied
      </div>
    );
  }

  const isDestructive = permissionLevel === 'DESTRUCTIVE';

  return (
    <div style={{
      background: '#fff8e8',
      border: '1px solid var(--warning)',
      borderTop: '3px solid var(--warning)',
      borderRadius: 10,
      padding: '16px 20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
        <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--warning)' }}>Approval Required</span>
        <span style={{
          marginLeft: 'auto', fontSize: 10, padding: '2px 8px', borderRadius: 9999,
          fontFamily: 'var(--font-mono)', fontWeight: 500,
          background: isDestructive ? '#fdecea' : '#fff8e8',
          color: isDestructive ? 'var(--error)' : '#7d5200',
          border: `1px solid ${isDestructive ? '#f0b0b0' : '#e8c97a'}`,
        }}>
          {isDestructive ? '⚠ DESTRUCTIVE' : permissionLevel}
        </span>
      </div>

      <p style={{ fontSize: 13, color: 'var(--body)', marginBottom: 10 }}>
        DStack wants to execute the following action:
      </p>

      {/* Code block */}
      <div style={{
        background: 'var(--surface-dark)', color: 'var(--on-dark)',
        fontFamily: 'var(--font-mono)', fontSize: 12,
        borderRadius: 6, padding: '10px 12px', marginBottom: 12,
      }}>
        {toolName && <div style={{ color: 'var(--coral)', marginBottom: 4 }}>{toolName}</div>}
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--on-dark-soft)' }}>
          {description}
          {args && Object.keys(args).length > 0 && '\n' + JSON.stringify(args, null, 2)}
        </pre>
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => onRespond('approve')}
          style={{
            flex: 1, height: 36, borderRadius: 8, border: 'none',
            background: 'var(--coral)', color: '#fff',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          Approve
        </button>
        <button
          onClick={() => onRespond('deny')}
          style={{
            flex: 1, height: 36, borderRadius: 8,
            border: '1px solid var(--error)', background: '#fff',
            color: 'var(--error)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          Deny
        </button>
      </div>
      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)' }}>Y to approve · N to deny</p>
    </div>
  );
}
