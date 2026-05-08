'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react';
import { api, type Artifact, type ArtifactVersion } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';
import { Download } from 'lucide-react';

interface ArtifactRailProps {
  selectedSkill?: string | null;
}

function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 2);

  if (data === null) return <span style={{ color: 'var(--muted)' }}>null</span>;
  if (typeof data === 'boolean') return <span style={{ color: '#6f42c1' }}>{String(data)}</span>;
  if (typeof data === 'number') return <span style={{ color: 'var(--amber)' }}>{data}</span>;
  if (typeof data === 'string') return <span style={{ color: 'var(--success)' }}>&quot;{data}&quot;</span>;

  if (Array.isArray(data)) {
    if (collapsed) return <span onClick={() => setCollapsed(false)} style={{ cursor: 'pointer', color: 'var(--muted)' }}>[…{data.length}]</span>;
    return (
      <span>
        <span onClick={() => setCollapsed(true)} style={{ cursor: 'pointer' }}>[</span>
        <div style={{ paddingLeft: 12 }}>
          {data.map((item, i) => (
            <div key={i}><JsonTree data={item} depth={depth + 1} />{i < data.length - 1 ? ',' : ''}</div>
          ))}
        </div>]
      </span>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (collapsed) return <span onClick={() => setCollapsed(false)} style={{ cursor: 'pointer', color: 'var(--muted)' }}>{'{'}{entries.length} keys{'}'}</span>;
    return (
      <span>
        <span onClick={() => setCollapsed(true)} style={{ cursor: 'pointer' }}>{'{'}</span>
        <div style={{ paddingLeft: 12 }}>
          {entries.map(([k, v], i) => (
            <div key={k}>
              <span style={{ color: 'var(--coral)' }}>&quot;{k}&quot;</span>: <JsonTree data={v} depth={depth + 1} />
              {i < entries.length - 1 ? ',' : ''}
            </div>
          ))}
        </div>{'}'}
      </span>
    );
  }

  return <span>{String(data)}</span>;
}

export default function ArtifactRail({ selectedSkill }: ArtifactRailProps) {
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'formatted' | 'json'>('formatted');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedSkill) return;
    setLoading(true);
    Promise.all([
      api.getLatestArtifact(selectedSkill).catch(() => null),
      api.getArtifactVersions(selectedSkill).catch(() => []),
    ]).then(([art, vers]) => {
      setArtifact(art);
      setVersions(Array.isArray(vers) ? vers : []);
      setActiveVersion(null);
    }).finally(() => setLoading(false));
  }, [selectedSkill]);

  if (!selectedSkill) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Select an artifact or complete a skill run</p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 16 }}>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-block" style={{ height: 200 }} />
    </div>;
  }

  if (!artifact) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>No artifact for /{selectedSkill} yet</p>
      </div>
    );
  }

  const verdict = artifact.overallVerdict as BadgeVariant | undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--hairline)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: 'var(--coral)' }}>/{selectedSkill}</span>
            {verdict && <Badge variant={verdict}>{verdict}</Badge>}
          </div>

          {/* Version pills */}
          {versions.length > 1 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveVersion(null)}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 8px', borderRadius: 9999, cursor: 'pointer',
                  background: activeVersion === null ? 'var(--coral-bg)' : 'var(--canvas)',
                  border: `1px solid ${activeVersion === null ? 'var(--coral)' : 'var(--hairline)'}`,
                  color: activeVersion === null ? 'var(--coral)' : 'var(--muted)',
                }}
              >
                latest
              </button>
              {versions.slice(0, 4).map(v => (
                <button
                  key={v.timestamp}
                  onClick={() => setActiveVersion(v.timestamp)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 8px', borderRadius: 9999, cursor: 'pointer',
                    background: activeVersion === v.timestamp ? 'var(--coral-bg)' : 'var(--canvas)',
                    border: `1px solid ${activeVersion === v.timestamp ? 'var(--coral)' : 'var(--hairline)'}`,
                    color: activeVersion === v.timestamp ? 'var(--coral)' : 'var(--muted)',
                  }}
                >
                  {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
            </div>
          )}

          {/* View tabs */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {(['formatted', 'json'] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
                  background: viewMode === m ? 'var(--surface-card)' : 'transparent',
                  border: `1px solid ${viewMode === m ? 'var(--hairline)' : 'transparent'}`,
                  color: viewMode === m ? 'var(--ink)' : 'var(--muted)',
                  fontWeight: viewMode === m ? 500 : 400,
                }}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Export Hub */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button 
            onClick={() => {
              const blob = new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${selectedSkill}-artifact.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface-card)', border: '1px solid var(--hairline)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--ink)', cursor: 'pointer' }}
            title="Export JSON"
          >
            <Download size={12} /> JSON
          </button>
          <button 
            onClick={() => {
              const md = Object.entries(artifact).map(([k, v]) => `## ${k}\n\`\`\`json\n${JSON.stringify(v, null, 2)}\n\`\`\``).join('\n\n');
              const blob = new Blob([md], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${selectedSkill}-artifact.md`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface-card)', border: '1px solid var(--hairline)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--ink)', cursor: 'pointer' }}
            title="Export Markdown"
          >
            <Download size={12} /> MD
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {viewMode === 'json' ? (
          <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6, margin: 0 }}>
            <JsonTree data={artifact} />
          </pre>
        ) : (
          <div>
            {Object.entries(artifact)
              .filter(([k]) => k !== 'skillName' && k !== 'generatedAt')
              .map(([key, val]) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--muted)', marginBottom: 2 }}>
                    {key}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                    {typeof val === 'object' ? (
                      <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-card)', padding: 8, borderRadius: 6, margin: 0, whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(val, null, 2)}
                      </pre>
                    ) : String(val)}
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}
