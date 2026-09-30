'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import StatusBadge from '@/components/StatusBadge';
import JsonViewer from '@/components/JsonViewer';
import { useApp } from '@/lib/app-context';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Box, Download, Clock, History, GitCompare } from 'lucide-react';
import ArtifactDiff from '@/components/ArtifactDiff';
import { api, type ArtifactDiff as ArtifactDiffType, type ArtifactVersion } from '@/lib/api';

// The route segment is the skill name: this page shows that skill's latest artifact and its history.
export default function ArtifactDetailPage() {
  const params = useParams();
  const skillName = params.id as string;
  const { artifacts, isLoading } = useApp();
  const [compareVersion, setCompareVersion] = React.useState<string | null>(null);
  // The diff we last fetched, tagged with the version it was for. Loading and the visible
  // diff are derived from it, so switching versions never shows a stale diff.
  const [fetchedDiff, setFetchedDiff] = React.useState<{ version: string; data: ArtifactDiffType | null } | null>(null);
  const [versions, setVersions] = React.useState<ArtifactVersion[]>([]);

  const artifact = artifacts.find(a => a.skillName === skillName);
  const diffData = compareVersion && fetchedDiff?.version === compareVersion ? fetchedDiff.data : null;
  const diffLoading = compareVersion !== null && fetchedDiff?.version !== compareVersion;

  React.useEffect(() => {
    let cancelled = false;
    api.getArtifactVersions(skillName)
      .then((list) => list, () => [])
      .then((list) => { if (!cancelled) setVersions([...list].reverse()); });
    return () => { cancelled = true; };
  }, [skillName, artifact?.createdAt]);

  React.useEffect(() => {
    if (!compareVersion) return;
    let cancelled = false;
    // v1 is the older version, v2 is the current latest.
    api.getArtifactDiff(skillName, compareVersion, 'latest')
      .then((data) => data, () => null)
      .then((data) => { if (!cancelled) setFetchedDiff({ version: compareVersion, data }); });
    return () => { cancelled = true; };
  }, [compareVersion, skillName]);

  if (!artifact) {
    return (
      <AppShell breadcrumbs={[{ label: 'Artifacts', href: '/artifacts' }, { label: skillName }]}>
        <div style={{ padding: 32, textAlign: 'center' }}>
          {isLoading ? (
            <div className="skeleton skeleton-block" style={{ height: 120, maxWidth: 480, margin: '0 auto' }} />
          ) : (
            <>
              <h2 style={{ fontSize: 20, fontFamily: 'var(--font-sans)', marginBottom: 8 }}>No artifact for /{skillName} yet</h2>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>Run /{skillName} to create one.</p>
              <Link href="/artifacts" className="btn btn-secondary">← Back to Artifacts</Link>
            </>
          )}
        </div>
      </AppShell>
    );
  }

  const filename = artifact.relativePath.split('/').pop() || `${skillName}.json`;
  const olderVersions = versions.slice(1);

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(artifact.content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${skillName}-artifact.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell
      breadcrumbs={[{ label: 'Artifacts', href: '/artifacts' }, { label: `/${skillName}` }]}
      actions={
        <button className="btn btn-primary" onClick={downloadJson} style={{ fontSize: 12, height: 30, padding: '0 12px' }}>
          <Download size={12} /> Download JSON
        </button>
      }
    >
      <div style={{ padding: 32 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h1 style={{ fontSize: 28, fontFamily: 'var(--font-serif)' }}>/{skillName}</h1>
            <span className="badge badge-success" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>Latest</span>
            {artifact.verdict && <StatusBadge status={artifact.verdict === 'PASS' ? 'success' : artifact.verdict === 'FAIL' ? 'error' : 'warning'} label={artifact.verdict} />}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--color-text-tertiary)', flexWrap: 'wrap' }}>
            <span>Versions: <strong>{versions.length || 1}</strong></span>
            <span>Path: <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{artifact.relativePath}</strong></span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 24, height: 'calc(100vh - 250px)' }}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {compareVersion ? (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {diffLoading ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading diff…</div>
                ) : diffData ? (
                  <ArtifactDiff v1={diffData.v1} v2={diffData.v2} semanticSummary={diffData.semanticSummary} />
                ) : (
                  <div role="alert" style={{ padding: 40, textAlign: 'center', color: 'var(--error)' }}>Couldn&apos;t load this comparison. The version may have been removed.</div>
                )}
              </div>
            ) : (
              <JsonViewer data={artifact.content ?? {}} title={filename} />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: 12 }}>Summary</h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{artifact.summary}</p>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <History size={12} /> Version history
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => setCompareVersion(null)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: compareVersion === null ? 'var(--color-primary-soft)' : 'transparent', border: 'none', cursor: 'pointer' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}>Latest</span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{new Date(artifact.createdAt).toLocaleString()}</span>
                </button>
                {olderVersions.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>No earlier versions.</p>}
                {olderVersions.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setCompareVersion(compareVersion === v.id ? null : v.id)}
                    aria-pressed={compareVersion === v.id}
                    aria-label={`Compare latest with version from ${new Date(v.timestamp).toLocaleString()}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', padding: '6px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      border: 'none', background: compareVersion === v.id ? 'var(--coral-bg)' : 'transparent', color: compareVersion === v.id ? 'var(--coral)' : 'var(--color-text-secondary)'
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{new Date(v.timestamp).toLocaleString()}{v.verdict ? ` · ${v.verdict}` : ''}</span>
                    <GitCompare size={14} />
                  </button>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: 12 }}>Metadata</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={12} style={{ color: 'var(--color-text-muted)' }} />
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Created: {new Date(artifact.createdAt).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Box size={12} style={{ color: 'var(--color-text-muted)' }} />
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Skill: /{skillName}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
