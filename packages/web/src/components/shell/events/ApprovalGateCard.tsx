'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Check, X, Fingerprint } from 'lucide-react';
import type { ApprovalGate } from '@dstack/shared';

interface ApprovalGateCardProps {
  description?: string;
  gate?: ApprovalGate;
  onRespond: (decision: 'approve' | 'deny') => void;
  status?: 'pending' | 'approved' | 'denied';
}

export default function ApprovalGateCard({ description, gate, onRespond, status = gate?.status ?? 'pending' }: ApprovalGateCardProps) {
  const body = gate?.description ?? description ?? 'Approval is required before this workflow can continue.';
  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
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
            {gate?.title ?? 'Approval Required'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            Human-in-the-loop gate active{gate ? ` for ${gate.actor}` : ''}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 16, fontWeight: 500 }}>
        {body}
      </p>

      {gate && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 16, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Fingerprint size={13} />
            <span style={{ fontFamily: 'var(--font-mono)' }}>{gate.artifactHash ?? 'pending hash'}</span>
          </div>
          <div><strong>Files:</strong> {gate.fileImpact.length > 0 ? gate.fileImpact.join(', ') : 'none'}</div>
          <div><strong>Commands:</strong> {gate.commandImpact.length > 0 ? gate.commandImpact.join(', ') : 'none'}</div>
          <div><strong>Safety:</strong> {gate.safetyMode}</div>
        </div>
      )}

      {status === 'pending' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <motion.button whileTap={{ scale: 0.98 }} className="btn btn-primary" style={{ flex: 1, backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', minHeight: 42 }} onClick={() => onRespond('approve')}>
            <Check size={16} /> Approve & Build
          </motion.button>
          <motion.button whileTap={{ scale: 0.98 }} className="btn btn-secondary" style={{ flex: 1, minHeight: 42 }} onClick={() => onRespond('deny')}>
            <X size={16} /> Reject & Modify
          </motion.button>
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
    </motion.div>
  );
}
