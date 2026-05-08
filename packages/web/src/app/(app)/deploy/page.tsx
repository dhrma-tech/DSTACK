'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api, type DeployConfig, type DeployState } from '@/lib/api';

export default function DeployPage() {
  const [config, setConfig] = useState<DeployConfig | null>(null);
  const [state, setState] = useState<DeployState | null>(null);
  const [freezeReason, setFreezeReason] = useState('');

  useEffect(() => {
    Promise.all([
      api.getDeployConfig().catch(() => null),
      api.getDeployState().catch(() => null),
    ]).then(([c, s]) => { setConfig(c); setState(s); });
  }, []);

  const handleFreeze = async () => {
    await api.freezeDeploy(freezeReason || undefined).catch(() => null);
    const s = await api.getDeployState().catch(() => null);
    if (s) setState(s);
  };

  const handleUnfreeze = async () => {
    await api.unfreezeDeploy().catch(() => null);
    const s = await api.getDeployState().catch(() => null);
    if (s) setState(s);
  };

  return (
    <AppShell>
      <div style={{ height: '100%', overflowY: 'auto', padding: 24, background: 'var(--canvas)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, marginBottom: 24 }}>Deploy</h1>
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Config */}
          <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Configuration</h2>
            {!config ? (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                Deploy not configured. Run <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--coral)' }}>/setup-deploy</span> to begin.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([['Platform', config.platform], ['Command', config.deployCommand], ...(config.healthCheckUrl ? [['Health Check', config.healthCheckUrl]] : [])] as [string, string][]).map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)', width: 120, flexShrink: 0 }}>{label}</span>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{value}</code>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Freeze control */}
          <div style={{ background: '#fff', border: `1px solid ${state?.frozen ? 'var(--error)' : 'var(--hairline)'}`, borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Freeze Control</h2>
            {state?.frozen ? (
              <div>
                <div style={{ background: '#fdecea', border: '1px solid #f0b0b0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--error)', marginBottom: 4 }}>🔒 DEPLOY FROZEN</div>
                  {state.reason && <p style={{ fontSize: 13, color: 'var(--error)' }}>{state.reason}</p>}
                  {state.frozenAt && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Since {new Date(state.frozenAt).toLocaleString()}</p>}
                </div>
                <button onClick={handleUnfreeze} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Unfreeze</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={freezeReason} onChange={e => setFreezeReason(e.target.value)} placeholder="Reason (optional)" style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--hairline)', borderRadius: 6, fontSize: 13, outline: 'none' }} />
                <button onClick={handleFreeze} style={{ background: 'none', border: '1px solid var(--coral)', color: 'var(--coral)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Freeze deploys</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
