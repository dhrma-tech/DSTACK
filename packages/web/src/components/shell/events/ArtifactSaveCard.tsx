'use client';

import React from 'react';
import { Box, ExternalLink } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';

interface ArtifactSaveCardProps {
  skillName: string;
  verdict: 'PASS' | 'FAIL' | 'REVISE' | null;
  path: string;
}

export default function ArtifactSaveCard({ skillName, verdict, path: artifactPath }: ArtifactSaveCardProps) {
  const fileName = artifactPath.split(/[\\/]/).pop();

  return (
    <div className="card" style={{
      marginBottom: 16,
      border: '1px solid var(--color-success-soft)',
      backgroundColor: 'rgba(16,185,129,0.02)',
      padding: '12px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--radius-md)',
          backgroundColor: 'rgba(16,185,129,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-success)'
        }}>
          <Box size={20} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{fileName}</span>
            {verdict && <StatusBadge status={verdict.toLowerCase() as any} label={verdict} />}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            Artifact saved by /{skillName}
          </div>
        </div>
      </div>
      
      <Link href="/artifacts" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12, height: 'fit-content' }}>
        View <ExternalLink size={12} style={{ marginLeft: 4 }} />
      </Link>
    </div>
  );
}
