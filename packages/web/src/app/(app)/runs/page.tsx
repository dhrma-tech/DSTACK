'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import { useApp } from '@/lib/app-context';
import Link from 'next/link';
import { Clock, ExternalLink, History } from 'lucide-react';

export default function RunsPage() {
  const { runs, isLoading } = useApp();

  return (
    <AppShell breadcrumbs={[{ label: 'Runs' }]}>
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontFamily: 'var(--font-serif)', marginBottom: 4 }}>Run History</h1>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>
            Complete audit log of every skill execution in your environment.
          </p>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2, 3, 4, 5].map((i: number) => <div key={i} className="skeleton skeleton-block" style={{ height: 48 }} />)}
          </div>
        ) : runs.length === 0 ? (
          <EmptyState icon={<History size={48} strokeWidth={1} />} title="No runs yet"
            description="Execute a skill from the Skills page to see run history here." />
        ) : (
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-soft)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Skill</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Verdict</th>
                  <th>Duration</th>
                  <th>Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run: any) => (
                  <tr key={run.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>{run.id}</td>
                    <td style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{run.command}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>
                        {run.fakeMode ? 'fake' : run.provider}
                      </span>
                    </td>
                    <td><StatusBadge status={run.status as any} /></td>
                    <td>
                      {run.verdict
                        ? <StatusBadge status={run.verdict === 'PASS' ? 'success' : run.verdict === 'FAIL' ? 'error' : 'warning'} label={run.verdict} />
                        : <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>—</span>
                      }
                    </td>
                    <td>{run.duration}</td>
                    <td style={{ fontSize: 12 }}>
                      <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {new Date(run.requestedAt).toLocaleDateString()}
                    </td>
                    <td>
                      <Link href={`/runs/${run.id}`} style={{ color: 'var(--color-primary)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ExternalLink size={12} /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
