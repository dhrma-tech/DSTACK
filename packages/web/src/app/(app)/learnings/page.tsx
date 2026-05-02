'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import EmptyState from '@/components/EmptyState';
import { useApp } from '@/lib/app-context';
import { Brain, Tag, Calendar, User } from 'lucide-react';

export default function LearningsPage() {
  const { learnings } = useApp();

  return (
    <AppShell breadcrumbs={[{ label: 'Learnings' }]}>
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontFamily: 'var(--font-serif)', marginBottom: 4 }}>Learnings</h1>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>
            Project memory — key decisions, insights, and patterns learned across runs.
          </p>
        </div>

        {learnings.length === 0 ? (
          <EmptyState
            icon={<Brain size={48} strokeWidth={1} />}
            title="No learnings recorded"
            description="Learnings are captured during retrospectives and context-save operations."
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
            {learnings.map(learn => (
              <div key={learn.id} className="card" style={{ padding: 24, borderLeft: '4px solid var(--color-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <span className="badge badge-primary" style={{ fontSize: 10 }}>{learn.topic}</span>
                  <span className="badge badge-neutral" style={{ fontSize: 10, textTransform: 'capitalize' }}>Source: {learn.source}</span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-sans)', lineHeight: 1.5, marginBottom: 16, color: 'var(--color-text-primary)' }}>
                  &ldquo;{learn.insight}&rdquo;
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--color-border-soft)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-muted)' }}>
                    <Calendar size={12} /> {new Date(learn.createdAt).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-muted)' }}>
                    <User size={12} /> {learn.source === 'manual' ? 'User' : 'DStack Agent'}
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
