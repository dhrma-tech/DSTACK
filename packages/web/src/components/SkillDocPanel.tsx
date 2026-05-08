import React from 'react';
import type { SkillSummary } from '@/lib/api';
import { BookOpen, Box, AlertTriangle, Fingerprint, Zap } from 'lucide-react';

interface SkillDocPanelProps {
  skill: any;
}

export default function SkillDocPanel({ skill }: SkillDocPanelProps) {
  return (
    <div style={{
      background: 'var(--surface-dark)',
      border: '1px solid var(--hairline)',
      borderRadius: 8,
      padding: 16,
      marginTop: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      animation: 'slideDown 0.2s ease-out'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--coral)', borderBottom: '1px solid var(--hairline)', paddingBottom: 8 }}>
        <BookOpen size={14} />
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Documentation</span>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
          Purpose
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, margin: 0 }}>
          {skill.description}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Box size={12} /> Produces
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>
            /{skill.name} artifact
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Fingerprint size={12} /> Model
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink)' }}>
            {skill.model}
          </div>
        </div>
      </div>

      {skill.requiresArtifacts.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={12} /> Prerequisites
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {skill.requiresArtifacts.map((req: string) => (
              <span key={req} style={{ background: 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 4, padding: '2px 6px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
                /{req}
              </span>
            ))}
          </div>
        </div>
      )}

      {skill.allowedTools && skill.allowedTools.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} /> Tool Permissions
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
            This skill is authorized to use: {skill.allowedTools.join(', ')}.
          </div>
        </div>
      )}
    </div>
  );
}
