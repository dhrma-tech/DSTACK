import React, { useState, useEffect } from 'react';
import { AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';

export interface ConflictRecord {
  artifactA: string;
  artifactB: string;
  field: string;
  conflict: string;
  severity: 'high' | 'medium' | 'low';
}

export default function ConflictWarning() {
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Poll for conflicts every 15s or on load
    const loadConflicts = () => {
      api.getWorkflowConflicts()
        .then(res => setConflicts(res.conflicts))
        .catch(() => null);
    };
    loadConflicts();
    const int = setInterval(loadConflicts, 15000);
    return () => clearInterval(int);
  }, []);

  if (conflicts.length === 0) return null;

  return (
    <div style={{
      background: 'rgba(245, 158, 11, 0.04)',
      border: '1px solid rgba(245, 158, 11, 0.3)',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 24,
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <AlertTriangle size={16} style={{ color: '#d97706' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#b45309' }}>
          {conflicts.length} Cross-Skill Conflict{conflicts.length > 1 ? 's' : ''} Detected
        </span>
        <div style={{ marginLeft: 'auto', color: '#d97706', display: 'flex', alignItems: 'center' }}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {conflicts.map((c, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: 8, padding: 12,
                borderLeft: `3px solid ${c.severity === 'high' ? 'var(--error)' : c.severity === 'medium' ? '#d97706' : 'var(--muted)'}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>
                    /{c.artifactA}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>vs</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>
                    /{c.artifactB}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700, color: c.severity === 'high' ? 'var(--error)' : '#d97706' }}>
                    {c.severity}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Field: {c.field}</span> — {c.conflict}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
