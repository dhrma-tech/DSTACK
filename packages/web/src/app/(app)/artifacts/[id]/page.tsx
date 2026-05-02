'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import StatusBadge from '@/components/StatusBadge';
import JsonViewer from '@/components/JsonViewer';
import { useApp } from '@/lib/app-context';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Box, Download, Clock, History, AlertTriangle } from 'lucide-react';

export default function ArtifactDetailPage() {
  const params = useParams();
  const artifactId = params.id as string;
  const { artifacts } = useApp();

  const artifact = artifacts.find(a => a.id === artifactId);

  if (!artifact) {
    return (
      <AppShell breadcrumbs={[{ label: 'Artifacts', href: '/artifacts' }, { label: artifactId }]}>
        <div style={{ padding: 32, textAlign: 'center' }}>
          <h2 style={{ fontSize: 20, fontFamily: 'var(--font-sans)', marginBottom: 8 }}>Artifact not found</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>No artifact with ID &quot;{artifactId}&quot; exists.</p>
          <Link href="/artifacts" className="btn btn-secondary">← Back to Artifacts</Link>
        </div>
      </AppShell>
    );
  }

  const filename = artifact.relativePath.split('/').pop() || artifact.id;
  const otherVersions = artifacts.filter(a => a.relativePath === artifact.relativePath && a.id !== artifact.id);

  return (
    <AppShell
      breadcrumbs={[{ label: 'Artifacts', href: '/artifacts' }, { label: filename }]}
      actions={
        <button className="btn btn-primary" style={{ fontSize: 12, height: 30, padding: '0 12px' }}>
          <Download size={12} /> Download JSON
        </button>
      }
    >
      <div style={{ padding: 32 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h1 style={{ fontSize: 28, fontFamily: 'var(--font-serif)' }}>{filename}</h1>
            {artifact.isLatest && <span className="badge badge-success" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>Latest</span>}
            {artifact.verdict && <StatusBadge status={artifact.verdict === 'PASS' ? 'success' : artifact.verdict === 'FAIL' ? 'error' : 'warning'} label={artifact.verdict} />}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--color-text-tertiary)' }}>
            <span>Skill: <strong style={{ color: 'var(--color-text-primary)' }}>{artifact.skillName}</strong></span>
            <span>Version: <strong>{artifact.version}</strong></span>
            <span>Type: <strong>{artifact.artifactType}</strong></span>
            <span>Path: <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{artifact.relativePath}</strong></span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, height: 'calc(100vh - 250px)' }}>
          {/* JSON Viewer */}
          <div style={{ height: '100%' }}>
            <JsonViewer data={artifact.content || { error: "No content available" }} title={filename} />
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: 12 }}>Summary</h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {artifact.summary || 'No summary provided for this artifact.'}
              </p>
            </div>

            {/* Warnings */}
            {artifact.warnings.length > 0 && (
              <div className="card" style={{ padding: 20, border: '1px solid rgba(245,158,11,0.2)', backgroundColor: 'rgba(245,158,11,0.02)' }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-warning)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={12} /> Warnings
                </h3>
                {artifact.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>• {w}</div>
                ))}
              </div>
            )}

            {/* History */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <History size={12} /> Version History
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-primary-soft)', border: '1px solid var(--color-primary-soft)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}>{artifact.version} (Current)</span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Now</span>
                </div>
                {otherVersions.map(v => (
                  <Link key={v.id} href={`/artifacts/${v.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 'var(--radius-sm)', textDecoration: 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-soft)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{v.version}</span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{new Date(v.createdAt).toLocaleDateString()}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Metadata */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: 12 }}>Metadata</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={12} style={{ color: 'var(--color-text-muted)' }} />
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Created: {new Date(artifact.createdAt).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Box size={12} style={{ color: 'var(--color-text-muted)' }} />
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Skill: {artifact.skillName}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
