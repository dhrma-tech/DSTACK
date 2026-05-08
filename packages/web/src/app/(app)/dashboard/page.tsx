'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Badge from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';
import SuggestionBanner from '@/components/SuggestionBanner';
import { useApp } from '@/lib/app-context';
import { useSuggestions } from '@/hooks/useSuggestions';
import { api, type HealthReport, type RunRecord } from '@/lib/api';

export default function DashboardPage() {
  const { project, runs } = useApp();
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunRecord[]>([]);
  const { suggestions, loading: suggestionsLoading } = useSuggestions();

  useEffect(() => {
    api.getProjectHealth().then(setHealth).catch(() => null);
    api.getRuns(10).then(setRecentRuns).catch(() => null);
  }, []);

  const healthColor = !health
    ? 'var(--muted)'
    : health.score >= 80 ? 'var(--success)'
    : health.score >= 60 ? 'var(--warning)'
    : 'var(--error)';

  const displayRuns = recentRuns.length ? recentRuns : (runs as unknown as RunRecord[]);

  return (
    <AppShell>
      <div style={{ height: '100%', overflowY: 'auto', padding: 24, background: 'var(--canvas)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, color: 'var(--ink)', marginBottom: 24 }}>
          {project.name}
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, maxWidth: 1100 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Health score */}
            <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 64, fontFamily: 'var(--font-serif)', color: healthColor, lineHeight: 1 }}>
                  {health?.score ?? '–'}
                </span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{health?.status ?? 'Loading…'}</span>
              </div>
              {health?.recommendations.map((r, i) => (
                <p key={i} style={{ fontSize: 13, color: 'var(--body)', marginTop: 4, display: 'flex', gap: 6 }}>
                  <span>•</span><span>{r}</span>
                </p>
              ))}
              <Link href="/workflow" style={{ display: 'block', marginTop: 12, fontSize: 13, color: 'var(--coral)' }}>
                View full health report →
              </Link>
            </div>

            {/* Suggested Next */}
            <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, overflow: 'hidden' }}>
              <SuggestionBanner
                suggestions={suggestions}
                loading={suggestionsLoading}
              />
              {!suggestionsLoading && suggestions.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>All caught up! No pending suggestions.</p>
                </div>
              )}
            </div>


            {/* Recent activity */}
            <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, padding: 16 }}>
              <h2 style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--muted)', marginBottom: 12 }}>
                Recent Activity
              </h2>
              {displayRuns.slice(0, 10).map((run, i) => (
                <div key={run.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40, borderBottom: '1px solid var(--hairline)' }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: run.verdict === 'PASS' ? 'var(--success)' : run.verdict === 'FAIL' ? 'var(--error)' : 'var(--warning)',
                  }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--ink)', flex: 1 }}>
                    /{run.skillName}
                  </span>
                  {run.verdict && <Badge variant={run.verdict as BadgeVariant}>{run.verdict}</Badge>}
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                    {run.startedAt ? new Date(run.startedAt).toLocaleString() : ''}
                  </span>
                  <Link href={`/runs/${run.id}`} style={{ fontSize: 12, color: 'var(--coral)' }}>→</Link>
                </div>
              ))}
              {displayRuns.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>
                  No runs yet. Complete a skill run to see history.
                </p>
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Artifact status */}
            <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, padding: 20 }}>
              <h2 style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--muted)', marginBottom: 16 }}>
                Artifact Status
              </h2>
              <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                {[
                  { label: 'Total', value: project.artifactCounts.total },
                  { label: 'Latest', value: project.artifactCounts.latest },
                  { label: 'Stale', value: project.artifactCounts.stale, color: project.artifactCounts.stale > 0 ? 'var(--warning)' : undefined },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontFamily: 'var(--font-serif)', color: color ?? 'var(--ink)' }}>{value}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, padding: 16 }}>
              <h2 style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--muted)', marginBottom: 12 }}>
                Quick Links
              </h2>
              {[
                { href: '/dstack', label: 'Open Shell' },
                { href: '/workflow', label: 'View Workflow' },
                { href: '/artifacts', label: 'Browse Artifacts' },
                { href: '/deploy', label: 'Deploy Status' },
              ].map(({ href, label }) => (
                <Link key={href} href={href} style={{ display: 'block', padding: '8px 0', fontSize: 13, color: 'var(--coral)', borderBottom: '1px solid var(--hairline)' }}>
                  {label} →
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
