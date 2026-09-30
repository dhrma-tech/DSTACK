'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, Check, Settings, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { api, type Settings as ServerSettings } from '@/lib/api';

type Provider = 'fake' | 'gemini';

const STEPS = [
  { title: 'Welcome', description: "Let's get your workspace ready." },
  { title: 'Model provider', description: 'Choose what runs your skills.' },
  { title: 'Project idea', description: 'What are you building?' },
  { title: 'First run', description: 'Start /office-hours.' },
];

const MIN_IDEA_LENGTH = 10;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState<ServerSettings | null>(null);
  const [provider, setProvider] = useState<Provider>('fake');
  const [idea, setIdea] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadSettings = () =>
    api.getSettings().then(
      (s) => { setSettings(s); setError(null); },
      (err: unknown) => setError(err instanceof Error ? err.message : "Can't reach the DStack server. Start it with `pnpm server`.")
    );

  useEffect(() => {
    let cancelled = false;
    api.getSettings().then(
      (s) => { if (!cancelled) { setSettings(s); setProvider(s.provider); } },
      (err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Can't reach the DStack server. Start it with `pnpm server`."); }
    );
    return () => { cancelled = true; };
  }, []);

  const geminiMissing = provider === 'gemini' && settings?.geminiApiKeyStatus !== 'unverified';
  const canContinue = step === 2 ? settings !== null && !geminiMissing : step === 3 ? idea.trim().length >= MIN_IDEA_LENGTH : true;

  const next = async () => {
    setError(null);
    if (step === 2) {
      setBusy(true);
      try {
        setSettings(await api.updateSettings({ provider }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save the provider');
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setStep(step + 1);
  };

  const startFirstRun = async () => {
    setBusy(true);
    setError(null);
    try {
      const { runId } = await api.runSkill('office-hours', { idea: idea.trim() }, { provider });
      router.push(`/runs/${encodeURIComponent(runId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start /office-hours');
      setBusy(false);
    }
  };

  const optionStyle = (selected: boolean): React.CSSProperties => ({
    border: selected ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
    borderRadius: 'var(--rounded-lg)', padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', background: 'white', textAlign: 'left', width: '100%'
  });

  return (
    <main style={{ backgroundColor: 'var(--color-canvas)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px var(--spacing-xxl)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div aria-hidden="true" style={{ width: '24px', height: '24px', backgroundColor: 'var(--color-ink)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>*</div>
          <span className="serif" style={{ fontSize: '18px' }}>DStack</span>
        </div>
        <Link href="/workspace" className="muted" style={{ fontSize: '14px' }}>Skip setup</Link>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px 32px' }}>
        <div style={{ width: '100%', maxWidth: '800px', display: 'grid', gridTemplateColumns: 'minmax(0, 250px) minmax(0, 1fr)', gap: 'var(--spacing-xxl)' }}>
          <ol aria-label="Setup steps" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {STEPS.map((s, i) => (
              <li key={s.title} aria-current={step === i + 1 ? 'step' : undefined} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600,
                  backgroundColor: step > i + 1 ? 'var(--color-success)' : step === i + 1 ? 'var(--color-primary)' : 'var(--color-surface-soft)',
                  color: step >= i + 1 ? 'white' : 'var(--color-muted)',
                }}>
                  {step > i + 1 ? <Check size={14} /> : i + 1}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: step === i + 1 ? 600 : 400, color: step === i + 1 ? 'var(--color-ink)' : 'var(--color-muted)' }}>{s.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-muted-soft)' }}>{s.description}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="card" style={{ backgroundColor: 'white', border: '1px solid var(--color-hairline)', padding: 'var(--spacing-xxl)', minWidth: 0 }}>
            {step === 1 && (
              <div>
                <h1 className="serif" style={{ fontSize: '36px', marginBottom: 'var(--spacing-md)' }}>From idea to shipped</h1>
                <p style={{ color: 'var(--color-body)', fontSize: '18px', lineHeight: 1.6, marginBottom: 'var(--spacing-xl)' }}>
                  DStack runs your project through named skills: a brief, a plan, reviews, QA, then ship. Each step saves an artifact, and later steps wait until earlier ones pass.
                </p>
                <div className="card" style={{ backgroundColor: 'var(--color-surface-soft)', padding: '20px', display: 'flex', gap: '16px' }}>
                  <Settings className="text-link" aria-hidden="true" />
                  <div style={{ fontSize: '14px', color: 'var(--color-muted)' }}>Next, choose a model provider and describe your project. Then DStack runs /office-hours to write your project brief.</div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h1 className="serif" style={{ fontSize: '36px', marginBottom: 'var(--spacing-md)' }}>Model provider</h1>
                <p className="muted" style={{ marginBottom: 'var(--spacing-xl)' }}>You can change this later in Settings.</p>
                <div role="radiogroup" aria-label="Model provider" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button role="radio" aria-checked={provider === 'fake'} onClick={() => setProvider('fake')} style={optionStyle(provider === 'fake')}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Demo mode (offline)</div>
                      <div className="muted" style={{ fontSize: '13px' }}>Built-in sample responses. No API key, no cost. Good for trying the workflow.</div>
                    </div>
                  </button>
                  <button role="radio" aria-checked={provider === 'gemini'} onClick={() => setProvider('gemini')} style={optionStyle(provider === 'gemini')}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Google Gemini</div>
                      <div className="muted" style={{ fontSize: '13px' }}>Real analysis of your project. Needs a Gemini API key.</div>
                    </div>
                  </button>
                </div>

                {provider === 'gemini' && settings && (
                  settings.geminiApiKeyStatus === 'unverified' ? (
                    <p style={{ marginTop: 'var(--spacing-lg)', fontSize: 14, color: 'var(--color-success)' }}>
                      <Check size={14} aria-hidden="true" /> A Gemini key was found ({settings.maskedKey}).
                    </p>
                  ) : (
                    <div className="card" style={{ marginTop: 'var(--spacing-lg)', padding: 16, backgroundColor: 'var(--color-surface-soft)' }}>
                      <p style={{ fontSize: 14, marginBottom: 8 }}>No Gemini key found. Add this line to the <code>.env</code> file in your project folder, then restart the server:</p>
                      <code style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 13, padding: '8px 12px', background: 'white', borderRadius: 6, overflowWrap: 'anywhere' }}>GEMINI_API_KEY=your-key-here</code>
                      <button onClick={() => void loadSettings()} className="btn btn-secondary" style={{ marginTop: 12, gap: 6 }}>
                        <RefreshCw size={14} aria-hidden="true" /> Check again
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            {step === 3 && (
              <div>
                <h1 className="serif" style={{ fontSize: '36px', marginBottom: 'var(--spacing-md)' }}>Project idea</h1>
                <label htmlFor="project-idea" className="muted" style={{ display: 'block', marginBottom: 'var(--spacing-md)' }}>What are you building? A few sentences is enough.</label>
                <textarea
                  id="project-idea"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="e.g. A habit tracker for small teams, with weekly check-ins and a Slack summary."
                  style={{ width: '100%', minHeight: '120px', padding: '16px', borderRadius: 'var(--rounded-lg)', border: '1px solid var(--color-hairline)', fontSize: '16px', resize: 'vertical' }}
                />
                <div className="muted-soft" style={{ fontSize: '13px', marginTop: 8 }}>/office-hours turns this into a project brief that every later skill reads.</div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h1 className="serif" style={{ fontSize: '36px', marginBottom: 'var(--spacing-md)' }}>Run /office-hours</h1>
                <p style={{ color: 'var(--color-body)', fontSize: '16px', lineHeight: 1.6, marginBottom: 'var(--spacing-lg)' }}>
                  DStack will write a project brief from your idea using {provider === 'fake' ? 'demo mode' : 'Gemini'}. You&apos;ll see the run as it happens.
                </p>
                <blockquote style={{ margin: '0 0 var(--spacing-xl)', padding: '12px 16px', borderLeft: '2px solid var(--color-primary)', background: 'var(--color-surface-soft)', fontSize: 14, overflowWrap: 'anywhere' }}>{idea.trim()}</blockquote>
                <button onClick={() => void startFirstRun()} disabled={busy} className="btn btn-primary" style={{ height: '48px', padding: '0 32px', fontSize: '16px' }}>
                  {busy ? 'Starting…' : 'Run /office-hours'}
                </button>
              </div>
            )}

            {error && <p role="alert" style={{ marginTop: 'var(--spacing-lg)', color: 'var(--color-error)', fontSize: 14 }}>{error}</p>}

            <div style={{ marginTop: 'var(--spacing-xxl)', paddingTop: 'var(--spacing-xl)', borderTop: '1px solid var(--color-hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {step > 1 ? (
                <button onClick={() => setStep(step - 1)} disabled={busy} className="btn btn-secondary" style={{ gap: '8px' }}>
                  <ChevronLeft size={16} aria-hidden="true" /> Back
                </button>
              ) : <div />}
              {step < 4 && (
                <button onClick={() => void next()} disabled={!canContinue || busy} className="btn btn-primary" style={{ gap: '8px' }}>
                  Continue <ChevronRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
