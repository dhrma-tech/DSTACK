import React from 'react';

type Status = 'success' | 'running' | 'error' | 'warning' | 'blocked' | 'idle' | 'stale' | 'complete' | 'not_run' | 'ready' | 'queued';

const STATUS_MAP: Record<string, { dot: string; badge: string; label: string }> = {
  success:  { dot: 'status-dot-success', badge: 'badge-success', label: 'Success' },
  complete: { dot: 'status-dot-success', badge: 'badge-success', label: 'Complete' },
  running:  { dot: 'status-dot-running', badge: 'badge-primary', label: 'Running' },
  queued:   { dot: 'status-dot-warning', badge: 'badge-warning', label: 'Queued' },
  error:    { dot: 'status-dot-error',   badge: 'badge-error',   label: 'Error' },
  warning:  { dot: 'status-dot-warning', badge: 'badge-warning', label: 'Warning' },
  blocked:  { dot: 'status-dot-warning', badge: 'badge-warning', label: 'Blocked' },
  stale:    { dot: 'status-dot-warning', badge: 'badge-warning', label: 'Stale' },
  idle:     { dot: 'status-dot-idle',    badge: 'badge-neutral',  label: 'Idle' },
  not_run:  { dot: 'status-dot-idle',    badge: 'badge-neutral',  label: 'Not Run' },
  ready:    { dot: 'status-dot-success', badge: 'badge-success', label: 'Ready' },
};

export default function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const cfg = STATUS_MAP[status] || STATUS_MAP.idle;
  return (
    <span className={`badge ${cfg.badge}`} style={{ textTransform: 'none', letterSpacing: 0 }}>
      <span className={`status-dot ${cfg.dot}`} />
      {label || cfg.label}
    </span>
  );
}
