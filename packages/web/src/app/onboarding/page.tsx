'use client';

import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Check, Key, Cpu, Settings } from 'lucide-react';
import Link from 'next/link';

export default function OnboardingPage() {
  const [step, setStep] = useState(1);

  const steps = [
    { title: 'Welcome', description: 'Let\'s get your workspace ready.' },
    { title: 'Model Provider', description: 'Connect your AI brain.' },
    { title: 'Project Scope', description: 'Define your first pipeline.' },
    { title: 'Ready to Run', description: 'You\'re all set.' },
  ];

  return (
    <main style={{ backgroundColor: 'var(--color-canvas)', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Mini Nav */}
      <div style={{ padding: '24px var(--spacing-xxl)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '24px', height: '24px', backgroundColor: 'var(--color-ink)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>*</div>
          <span className="serif" style={{ fontSize: '18px' }}>DStack</span>
        </div>
        <Link href="/workspace" className="muted" style={{ fontSize: '14px' }}>Skip Onboarding</Link>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '800px', display: 'grid', gridTemplateColumns: '250px 1fr', gap: 'var(--spacing-xxl)' }}>
          {/* Progress Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {steps.map((s, i) => (
              <div key={s.title} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ 
                  width: '28px', 
                  height: '28px', 
                  borderRadius: '50%', 
                  backgroundColor: step > i + 1 ? 'var(--color-success)' : step === i + 1 ? 'var(--color-primary)' : 'var(--color-surface-soft)',
                  color: step >= i + 1 ? 'white' : 'var(--color-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  flexShrink: 0
                }}>
                  {step > i + 1 ? <Check size={14} /> : i + 1}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: step === i + 1 ? 600 : 400, color: step === i + 1 ? 'var(--color-ink)' : 'var(--color-muted)' }}>{s.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-muted-soft)' }}>{s.description}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Content Area */}
          <div className="card" style={{ backgroundColor: 'white', border: '1px solid var(--color-hairline)', padding: 'var(--spacing-xxl)' }}>
            {step === 1 && (
              <div>
                <h1 className="serif" style={{ fontSize: '36px', marginBottom: 'var(--spacing-md)' }}>The Thinking IDE</h1>
                <p style={{ color: 'var(--color-body)', fontSize: '18px', lineHeight: 1.6, marginBottom: 'var(--spacing-xl)' }}>
                  DStack helps you orchestrate complex AI workflows through structured skills. 
                  Let's configure your environment to start executing.
                </p>
                <div className="card" style={{ backgroundColor: 'var(--color-surface-soft)', padding: '20px', display: 'flex', gap: '16px' }}>
                  <Settings className="text-link" />
                  <div style={{ fontSize: '14px', color: 'var(--color-muted)' }}>
                    We'll guide you through setting up your first Model Provider and creating your initial workspace.
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h1 className="serif" style={{ fontSize: '36px', marginBottom: 'var(--spacing-md)' }}>Connect a Provider</h1>
                <p className="muted" style={{ marginBottom: 'var(--spacing-xl)' }}>Select your primary AI model to power DStack.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ border: '2px solid var(--color-primary)', borderRadius: 'var(--rounded-lg)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '4px', backgroundColor: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>G</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>Google Gemini</div>
                        <div className="muted" style={{ fontSize: '12px' }}>Pro & Flash models</div>
                      </div>
                    </div>
                    <Check size={20} className="text-link" />
                  </div>
                  <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-lg)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '4px', backgroundColor: '#D97757', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>A</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>Anthropic Claude</div>
                        <div className="muted" style={{ fontSize: '12px' }}>Opus, Sonnet, Haiku</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '12px' }}>Coming soon</span>
                  </div>
                </div>

                <div style={{ marginTop: 'var(--spacing-xl)' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>API Key</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="password" placeholder="sk-••••••••" style={{ flex: 1, padding: '10px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', outline: 'none' }} />
                    <button className="btn btn-secondary">Test</button>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h1 className="serif" style={{ fontSize: '36px', marginBottom: 'var(--spacing-md)' }}>Project Scope</h1>
                <p className="muted" style={{ marginBottom: 'var(--spacing-xl)' }}>What are you building with DStack?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <textarea 
                    placeholder="e.g. Build an automated medical counseling system..."
                    style={{ width: '100%', minHeight: '120px', padding: '16px', borderRadius: 'var(--rounded-lg)', border: '1px solid var(--color-hairline)', fontSize: '16px', resize: 'none', outline: 'none' }}
                  />
                  <div className="muted-soft" style={{ fontSize: '13px' }}>
                    This helps us initialize relevant skills in your library.
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(93, 184, 114, 0.1)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <Check size={32} />
                </div>
                <h1 className="serif" style={{ fontSize: '36px', marginBottom: 'var(--spacing-md)' }}>You're ready.</h1>
                <p style={{ color: 'var(--color-body)', fontSize: '18px', lineHeight: 1.6, marginBottom: 'var(--spacing-xl)' }}>
                  Your workspace is initialized and your first skill is ready to run.
                </p>
                <Link href="/workspace" className="btn btn-primary" style={{ height: '48px', padding: '0 40px', fontSize: '16px', display: 'inline-flex' }}>
                  Launch Workspace
                </Link>
              </div>
            )}

            <div style={{ 
              marginTop: 'var(--spacing-xxl)', 
              paddingTop: 'var(--spacing-xl)', 
              borderTop: '1px solid var(--color-hairline)', 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {step > 1 && step < 4 ? (
                <button onClick={() => setStep(step - 1)} className="btn btn-secondary" style={{ gap: '8px' }}>
                  <ChevronLeft size={16} /> Back
                </button>
              ) : <div></div>}
              
              {step < 4 && (
                <button onClick={() => setStep(step + 1)} className="btn btn-primary" style={{ gap: '8px' }}>
                  Continue <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
