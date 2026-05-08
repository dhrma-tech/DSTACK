import React from 'react';
import Link from 'next/link';
import CodeWindow from '@/components/CodeWindow';
import {
  Play, Zap, ShieldCheck, ChevronRight, GitBranch,
  Box, BarChart3, Terminal, Rocket,
} from 'lucide-react';

export default function Home() {
  return (
    <main style={{ overflowX: 'hidden' }}>
      {/* Public Nav */}
      <nav className="glass" style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 32px', borderBottom: '1px solid var(--color-border-soft)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            backgroundColor: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: 14,
          }}>D</div>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-serif)' }}>DStack</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          <a href="#features" className="nav-link">Features</a>
          <a href="#skills" className="nav-link">Skills</a>
          <a href="#workflow" className="nav-link">Workflow</a>
          <Link href="/dashboard" className="btn btn-primary" style={{ marginLeft: 8, padding: '6px 16px', fontSize: 13 }}>
            Open Dashboard <ChevronRight size={14} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="section container animate-fade-in-up" style={{
        display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 48,
        alignItems: 'center', paddingTop: 100,
      }}>
        <div>
          <div className="badge badge-primary" style={{ marginBottom: 20 }}>DStack v0.8.2</div>
          <h1 style={{
            fontSize: 56, fontWeight: 500, fontFamily: 'var(--font-serif)',
            lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 20,
          }}>
            The AI Workflow<br />
            <span style={{ color: 'var(--color-primary)' }}>Execution Engine</span>
          </h1>
          <p style={{
            fontSize: 18, lineHeight: 1.6, color: 'var(--color-text-secondary)',
            maxWidth: 480, marginBottom: 32,
          }}>
            DStack orchestrates structured AI skills into repeatable workflows.
            Plan, design, review, test, and ship — all from a developer-first cockpit.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/dashboard" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: 15 }}>
              <Play size={16} /> Open Dashboard
            </Link>
            <Link href="/onboarding" className="btn btn-secondary" style={{ padding: '12px 28px', fontSize: 15 }}>
              Setup Guide
            </Link>
          </div>
        </div>
        <div>
          <CodeWindow
            title="Terminal — DStack"
            code={`$ pnpm ds -- /office-hours --idea "AI counseling SaaS"

[DSTACK] Initializing agentic loop...
[DSTACK] Provider: gemini-2.0-flash
[DSTACK] Skill: office-hours loaded (3 tools)
[DSTACK] Analyzing market landscape...
[DSTACK] 4 competitor patterns identified
[DSTACK] Generating roadmap.json artifact...
✓ Artifact saved: .dstack/artifacts/roadmap.json
✓ Next recommended: autoplan`}
          />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="section container" style={{ paddingTop: 64 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 36, fontFamily: 'var(--font-serif)', marginBottom: 12 }}>
            Not a chatbot. An execution engine.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', maxWidth: 560, margin: '0 auto' }}>
            Every skill has a defined schema, acceptance criteria, and artifact output.
            DStack replaces ad-hoc prompting with structured, repeatable workflows.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
            { icon: Zap, title: 'Structured Skills', desc: 'Each skill has a manifest with inputs, outputs, required artifacts, and allowed tools.' },
            { icon: GitBranch, title: 'Workflow Pipelines', desc: 'Chain skills into DAG-based workflows with prerequisite tracking and state handoff.' },
            { icon: ShieldCheck, title: 'Safety Gates', desc: 'NORMAL, CAREFUL, GUARD modes. Deploy freezes. Typed-hash confirmations for production.' },
            { icon: Box, title: 'Artifact System', desc: 'Versioned, validated JSON artifacts with diff comparison and staleness tracking.' },
            { icon: Terminal, title: 'Developer CLI', desc: 'Full CLI with skill invocation, benchmarks, and deploy management. Web UI optional.' },
            { icon: BarChart3, title: 'Model Benchmarks', desc: 'Compare models across quality, latency, cost, and token usage on your own prompt suites.' },
          ].map((f: { icon: React.FC<{ size: number; style?: React.CSSProperties }>; title: string; desc: string }) => (
            <div key={f.title} className="card" style={{ padding: 24 }}>
              <f.icon size={24} style={{ color: 'var(--color-primary)', marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-sans)', marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Skills Showcase */}
      <section id="skills" className="section container">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 36, fontFamily: 'var(--font-serif)', marginBottom: 12 }}>
            Built-in Skill Library
          </h2>
          <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', maxWidth: 520, margin: '0 auto' }}>
            10+ structured skills spanning the full product lifecycle.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { cmd: '/office-hours', stage: 'Planning' },
            { cmd: '/autoplan', stage: 'Planning' },
            { cmd: '/design-consultation', stage: 'Design' },
            { cmd: '/review', stage: 'QA' },
            { cmd: '/qa', stage: 'QA' },
            { cmd: '/ship', stage: 'Ship' },
            { cmd: '/benchmark', stage: 'QA' },
            { cmd: '/deploy', stage: 'Ship' },
          ].map((s: { cmd: string; stage: string }) => (
            <div key={s.cmd} className="card card-interactive" style={{ padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{s.cmd}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.stage}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow Preview */}
      <section id="workflow" className="section container">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 36, fontFamily: 'var(--font-serif)', marginBottom: 12 }}>
            Visual Workflow Pipeline
          </h2>
          <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', maxWidth: 480, margin: '0 auto' }}>
            See your entire project pipeline at a glance — what ran, what&apos;s next, and what&apos;s blocked.
          </p>
        </div>
        <div className="card" style={{ padding: 32, overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { name: '/office-hours', done: true },
              { name: '/autoplan', done: true },
              { name: '/design', done: false, active: true },
              { name: '/review', done: false },
              { name: '/qa', done: false },
              { name: '/ship', done: false },
            ].map((step: { name: string; done: boolean; active?: boolean }, i: number, arr: { name: string; done: boolean; active?: boolean }[]) => (
              <React.Fragment key={step.name}>
                <div style={{
                  padding: '10px 16px', borderRadius: 'var(--radius-md)',
                  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)',
                  border: `2px solid ${step.done ? 'var(--color-success)' : step.active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  backgroundColor: step.done ? 'rgba(16,185,129,0.04)' : step.active ? 'var(--color-primary-soft)' : 'transparent',
                  color: step.done ? 'var(--color-success)' : step.active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                }}>
                  {step.name}
                </div>
                {i < arr.length - 1 && <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <h2 style={{ fontSize: 36, fontFamily: 'var(--font-serif)', marginBottom: 12 }}>
          Start building with DStack
        </h2>
        <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', maxWidth: 400, margin: '0 auto 28px' }}>
          Run locally. No cloud required. Your data stays on your machine.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link href="/dashboard" className="btn btn-primary" style={{ padding: '14px 32px', fontSize: 16 }}>
            <Rocket size={18} /> Launch Dashboard
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--color-border-soft)',
        padding: '24px 32px', display: 'flex', justifyContent: 'space-between',
        fontSize: 12, color: 'var(--color-text-muted)',
      }}>
        <span>© 2026 DStack — AI Workflow Execution Engine</span>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href="#" className="nav-link">GitHub</a>
          <a href="#" className="nav-link">Docs</a>
          <a href="#" className="nav-link">Privacy</a>
        </div>
      </footer>
    </main>
  );
}
