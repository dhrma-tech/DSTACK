'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import StatusBadge from '@/components/StatusBadge';
import { useApp } from '@/lib/app-context';
import Link from 'next/link';
import {
  Zap, Box, History, ChevronRight, Play,
  AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';

export default function DashboardPage() {
  const { project, skills, runs, artifacts, workflow, isLoading } = useApp();

  const completedSkills = workflow.nodes.filter((n: any) => n.status === 'complete').length;
  const totalSkills = workflow.nodes.length;
  const suggestedSkill = workflow.suggestedNextSkills[0];
  const suggestedSkillData = skills.find((s: any) => s.name === suggestedSkill);

  return (
    <AppShell breadcrumbs={[{ label: 'Dashboard' }]}>
      <div style={{ padding: '32px 32px 64px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div>
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-text" style={{ width: '30%' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[1, 2, 3, 4].map((i: number) => <div key={i} className="skeleton skeleton-block" style={{ height: 100 }} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="skeleton skeleton-block" style={{ height: 180 }} />
              <div className="skeleton skeleton-block" style={{ height: 180 }} />
            </div>
          </div>
        ) : (
          <>
            {/* Project Header */}
            <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h1 style={{ fontSize: 32, fontFamily: 'var(--font-serif)' }}>{project.name}</h1>
            <span className="badge badge-neutral" style={{ textTransform: 'capitalize', letterSpacing: 0 }}>
              {project.workflowStage}
            </span>
          </div>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>
            {project.rootDisplayPath} · Provider: <strong>{project.provider.current}</strong>
          </p>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Workflow Progress', value: `${completedSkills}/${totalSkills}`, sub: 'skills completed', icon: Zap, color: 'var(--color-primary)' },
            { label: 'Artifacts', value: `${project.artifactCounts.latest}`, sub: `${project.artifactCounts.stale} stale`, icon: Box, color: 'var(--color-accent-teal)' },
            { label: 'Recent Runs', value: `${runs.length}`, sub: 'total runs', icon: History, color: 'var(--color-accent-blue)' },
            { label: 'Blockers', value: `${workflow.blockers.length}`, sub: workflow.blockers.length ? 'action needed' : 'all clear', icon: AlertTriangle, color: workflow.blockers.length ? 'var(--color-warning)' : 'var(--color-success)' },
          ].map((stat: any) => (
            <div key={stat.label} className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>{stat.label}</span>
                <stat.icon size={16} style={{ color: stat.color }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-sans)', lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Next Action + Workflow Mini */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
          {/* Next Action */}
          <div className="card" style={{ padding: 24, border: '1px solid var(--color-primary-soft)', background: 'linear-gradient(135deg, var(--color-surface) 0%, rgba(230,126,90,0.03) 100%)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-primary)', marginBottom: 12 }}>
              Recommended Next
            </div>
            {suggestedSkillData ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{suggestedSkillData.command}</div>
                <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>{suggestedSkillData.description}</p>
                <Link href={`/skills`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
                  <Play size={14} /> Run Skill
                </Link>
              </>
            ) : (
              <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>All skills completed — review your workflow.</p>
            )}
          </div>

          {/* Workflow Mini */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>Workflow</span>
              <Link href="/workflow" style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                View Full <ChevronRight size={12} />
              </Link>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {workflow.nodes.map((node: any, i: number) => (
                <React.Fragment key={node.id}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500,
                    backgroundColor: node.status === 'complete' ? 'rgba(16,185,129,0.08)' :
                      node.status === 'running' || node.status === 'ready' ? 'var(--color-primary-soft)' :
                        'var(--color-surface-soft)',
                    color: node.status === 'complete' ? 'var(--color-success)' :
                      node.status === 'running' || node.status === 'ready' ? 'var(--color-primary)' :
                        'var(--color-text-muted)',
                  }}>
                    {node.status === 'complete' && <CheckCircle2 size={12} />}
                    {(node.status === 'running' || node.status === 'ready') && <Play size={10} />}
                    {node.label}
                  </div>
                  {i < workflow.nodes.length - 1 && <ChevronRight size={12} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Runs */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>Recent Runs</h2>
            <Link href="/runs" style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600 }}>View all →</Link>
          </div>
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-soft)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Skill</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 5).map((run: any) => (
                  <tr key={run.id} style={{ cursor: 'pointer' }}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>{run.id}</td>
                    <td style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{run.command}</td>
                    <td><StatusBadge status={run.status as any} /></td>
                    <td>{run.duration}</td>
                    <td><Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />{new Date(run.requestedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Artifacts */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>Latest Artifacts</h2>
            <Link href="/artifacts" style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600 }}>View all →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {artifacts.filter((a: any) => a.isLatest).slice(0, 3).map((art: any) => (
              <div key={art.id} className="card card-interactive" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Box size={16} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{art.relativePath.split('/').pop()}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>{art.summary}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>from {art.skillName}</span>
                  {art.verdict && <StatusBadge status={art.verdict === 'PASS' ? 'success' : art.verdict === 'FAIL' ? 'error' : 'warning'} label={art.verdict} />}
                </div>
              </div>
            ))}
          </div>
        </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
