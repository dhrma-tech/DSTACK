'use client';

import React from 'react';
import { ShieldAlert, Check, X } from 'lucide-react';

interface ApprovalGateCardProps {
  description: string;
  onRespond: (decision: 'approve' | 'deny') => void;
  status: 'pending' | 'approved' | 'denied';
}

export default function ApprovalGateCard({ description, onRespond, status }: ApprovalGateCardProps) {
  return (
    <div className="card" style={{
      marginBottom: 16,
      border: '2px solid var(--color-warning)',
      backgroundColor: 'rgba(245,158,11,0.02)',
      padding: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          backgroundColor: 'var(--color-warning)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white'
        }}>
          <ShieldAlert size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-warning)' }}>
            Approval Required
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            Human-in-the-loop gate active
          </div>
        </div>
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 16, fontWeight: 500 }}>
        {description}
      </p>

      {status === 'pending' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ flex: 1, backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }} onClick={() => onRespond('approve')}>
            <Check size={14} /> Approve
          </button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => onRespond('deny')}>
            <X size={14} /> Deny
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600,
          color: status === 'approved' ? 'var(--color-success)' : 'var(--color-error)'
        }}>
          {status === 'approved' ? <Check size={14} /> : <X size={14} />}
          Action {status === 'approved' ? 'Approved' : 'Denied'}
        </div>
      )}
    </div>
  );
}
