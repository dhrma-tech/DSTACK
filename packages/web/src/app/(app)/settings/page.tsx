'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api, type Settings } from '@/lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [safetyMode, setSafetyMode] = useState<'NORMAL' | 'CAREFUL' | 'GUARD'>('NORMAL');

  useEffect(() => {
    api.getSettings().then(s => { setSettings(s); setSafetyMode(s.safetyMode as 'NORMAL' | 'CAREFUL' | 'GUARD'); }).catch(() => null);
  }, []);

  const handleSafetyMode = async (mode: 'NORMAL' | 'CAREFUL' | 'GUARD') => {
    setSafetyMode(mode);
    await api.setSafetyMode(mode).catch(() => null);
  };

  return (
    <AppShell>
      <div style={{ height: '100%', overflowY: 'auto', padding: 24, background: 'var(--canvas)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, marginBottom: 24 }}>Settings</h1>

        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* API Key */}
          <Section title="API Key">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <code style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13, background: 'var(--surface-card)', padding: '8px 12px', borderRadius: 8, color: 'var(--muted)' }}>
                {settings?.maskedKey ?? '••••••••'}
              </code>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontFamily: 'var(--font-mono)', fontWeight: 500,
                background: settings?.geminiApiKeyStatus === 'unverified' ? '#fff8e8' : 'var(--canvas)',
                color: settings?.geminiApiKeyStatus === 'unverified' ? '#7d5200' : 'var(--muted)',
                border: `1px solid ${settings?.geminiApiKeyStatus === 'unverified' ? '#e8c97a' : 'var(--hairline)'}`,
              }}>
                {settings?.geminiApiKeyStatus === 'unverified' ? 'Key found (not yet verified)' : 'Not configured'}
              </span>
            </div>
          </Section>

          {/* Model Config */}
          <Section title="Model Config">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Default Model', value: settings?.defaultModel ?? '—' },
                { label: 'Pro Model', value: settings?.proModel ?? '—' },
                { label: 'Max Tokens', value: String(settings?.maxTokens ?? '—') },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)', width: 140, flexShrink: 0 }}>{label}</span>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)' }}>{value}</code>
                </div>
              ))}
            </div>
          </Section>

          {/* Safety Mode */}
          <Section title="Safety Mode">
            <div style={{ display: 'flex', gap: 8 }}>
              {(['NORMAL', 'CAREFUL', 'GUARD'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => handleSafetyMode(mode)}
                  style={{
                    flex: 1, height: 40, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    background: safetyMode === mode ? 'var(--coral)' : 'transparent',
                    color: safetyMode === mode ? '#fff' : 'var(--muted)',
                    border: `1px solid ${safetyMode === mode ? 'var(--coral)' : 'var(--hairline)'}`,
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              CAREFUL: every tool call requires approval. GUARD: writes and execute blocked.
            </p>
          </Section>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, padding: 20 }}>
      <h2 style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  );
}
