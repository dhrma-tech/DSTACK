'use client';

import React, { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import StatusBadge, { toStatus } from '@/components/StatusBadge';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, Database, RotateCcw, Square, Wrench } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { api, DStackAPIError, type RunRecord, type ShellEvent } from '@/lib/api';
import { formatDuration } from '@/lib/view-models';

const POLL_MS = 2000;

function describeEvent(event: ShellEvent): { label: string; text: string; tone: string } {
  switch (event.type) {
    case 'reasoning': return { label: 'note', text: event.text, tone: 'var(--muted)' };
    case 'tool-call': return { label: 'tool', text: `${event.toolName} (${event.gateDecision})`, tone: event.gateDecision === 'DENY' ? 'var(--error)' : 'var(--ink)' };
    case 'tool-result': return { label: 'result', text: `${event.toolName}: ${event.error ?? `${event.output.length} characters in ${event.durationMs} ms`}`, tone: event.error ? 'var(--error)' : 'var(--body)' };
    case 'approval-required': return { label: 'approval', text: `${event.toolName} needs approval: ${event.description}`, tone: 'var(--amber)' };
    case 'artifact-saved': return { label: 'artifact', text: `Saved ${event.path}${event.verdict ? ` (${event.verdict})` : ''}`, tone: 'var(--success)' };
    case 'complete': return { label: 'done', text: `Finished: ${event.status}${event.verdict ? `, ${event.verdict}` : ''}`, tone: event.status === 'complete' ? 'var(--success)' : 'var(--error)' };
    case 'error': return { label: 'error', text: event.message, tone: 'var(--error)' };
  }
}

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.id as string;
  const [run, setRun] = useState<RunRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      api.getRun(runId).then((record) => {
        if (cancelled) return;
        setRun(record);
        setError(null);
        if (record.active) timer = setTimeout(load, POLL_MS);
      }, (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof DStackAPIError && err.status === 404 ? 'not-found' : err instanceof Error ? err.message : 'Failed to load run');
      });
    };
    load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [runId]);

  const stop = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await api.stopRun(runId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not stop the run');
    } finally {
      setBusy(false);
    }
  };

  const rerun = async () => {
    if (!run) return;
    setBusy(true);
    setActionError(null);
    try {
      const { runId: next } = await api.runSkill(run.skillName, run.inputs, run.flags);
      router.push(`/runs/${encodeURIComponent(next)}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not start the run');
      setBusy(false);
    }
  };

  if (error || !run) {
    return (
      <AppShell breadcrumbs={[{ label: 'Runs', href: '/runs' }, { label: runId }]}>
        <div style={{ padding: 32, textAlign: 'center' }}>
          {!error ? (
            <div className="skeleton skeleton-block" style={{ height: 120, maxWidth: 480, margin: '0 auto' }} />
          ) : (
            <>
              <h2 style={{ fontSize: 20, fontFamily: 'var(--font-sans)', marginBottom: 8 }}>{error === 'not-found' ? 'Run not found' : "Couldn't load this run"}</h2>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>{error === 'not-found' ? `No web run with ID "${runId}" exists. Runs started from the CLI only have a summary on the Runs page.` : error}</p>
              <Link href="/runs" className="btn btn-secondary">← Back to Runs</Link>
            </>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[{ label: 'Runs', href: '/runs' }, { label: `/${run.skillName}` }]}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          {run.active ? (
            <button className="btn btn-secondary" onClick={stop} disabled={busy} style={{ fontSize: 12, height: 30, padding: '0 12px' }}>
              <Square size={12} /> Stop run
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={rerun} disabled={busy} style={{ fontSize: 12, height: 30, padding: '0 12px' }}>
              <RotateCcw size={12} /> Re-run
            </button>
          )}
          <Link href={`/artifacts/${encodeURIComponent(run.skillName)}`} className="btn btn-primary" style={{ fontSize: 12, height: 30, padding: '0 12px' }}>
            View artifact
          </Link>
        </div>
      }
    >
      <div style={{ padding: 32 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 28, fontFamily: 'var(--font-serif)' }}>/{run.skillName}</h1>
          <StatusBadge status={toStatus(run.status)} />
          {run.verdict && <Badge variant={run.verdict}>{run.verdict}</Badge>}
          {run.provider === 'fake' && <Badge variant="FAKE">FAKE</Badge>}
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', marginBottom: 24 }}>{run.id}</p>
        {actionError && <p role="alert" style={{ color: 'var(--error)', fontSize: 13, marginBottom: 16 }}>{actionError}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 24 }}>
          <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 16, overflow: 'hidden', minWidth: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', background: 'var(--surface-card)', fontSize: 12, fontWeight: 600 }}>
              Event log ({run.events.length})
            </div>
            <ol aria-live={run.active ? 'polite' : 'off'} style={{ listStyle: 'none', margin: 0, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {run.events.map((event, index) => {
                const { label, text, tone } = describeEvent(event);
                return (
                  <li key={index} style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)', gap: 12 }}>
                    <span style={{ color: 'var(--muted-soft)', textTransform: 'uppercase', fontSize: 10, paddingTop: 2 }}>{label}</span>
                    <span style={{ color: tone, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 16, padding: 20, alignSelf: 'start' }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: Clock, label: 'Duration', value: formatDuration(run.durationMs, run.status) },
                { icon: Clock, label: 'Started', value: new Date(run.startedAt).toLocaleString() },
                { icon: Database, label: 'Provider', value: run.provider },
                { icon: Wrench, label: 'Tool calls', value: String(run.toolCallCount) },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{item.value}</div>
                </div>
              ))}
              {Object.keys(run.inputs).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Inputs</div>
                  {Object.entries(run.inputs).map(([key, value]) => (
                    <div key={key} style={{ fontSize: 12, overflowWrap: 'anywhere' }}><span style={{ fontFamily: 'var(--font-mono)' }}>{key}</span>: {value}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
