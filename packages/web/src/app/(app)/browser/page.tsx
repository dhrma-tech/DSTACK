'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import { useApp } from '@/lib/app-context';
import { type BrowserSnapshot } from '@/lib/mock-data';
import { Globe, AlertCircle, Clock, ExternalLink, ShieldAlert } from 'lucide-react';

export default function BrowserPage() {
  const { snapshots } = useApp();

  return (
    <AppShell breadcrumbs={[{ label: 'Browser / QA' }]}>
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontFamily: 'var(--font-serif)', marginBottom: 4 }}>Browser / QA</h1>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>
            Review browser snapshots, screenshots, and QA findings from automated testing.
          </p>
        </div>

        {snapshots.length === 0 ? (
          <EmptyState
            icon={<Globe size={48} strokeWidth={1} />}
            title="No browser sessions"
            description="Run /qa or /browse to capture browser snapshots and generate QA reports."
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {snapshots.map((snap: BrowserSnapshot) => (
              <div key={snap.id} className="card card-interactive" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Thumbnail placeholder */}
                <div style={{ height: 160, backgroundColor: 'var(--color-surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-soft)' }}>
                  <Globe size={48} strokeWidth={1} />
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>{snap.title}</h3>
                    {snap.promptInjectionDetected && (
                      <span title="Prompt injection fragment detected" style={{ color: 'var(--color-error)' }}>
                        <ShieldAlert size={16} />
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                    {snap.url}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--color-border-soft)' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {new Date(snap.createdAt).toLocaleTimeString()}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {snap.consoleErrors > 0 && <span style={{ fontSize: 11, color: 'var(--color-error)', fontWeight: 600 }}>{snap.consoleErrors} Errors</span>}
                      <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
                        Details <ExternalLink size={10} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
