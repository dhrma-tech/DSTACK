'use client';

import React, { useState } from 'react';
import AppShell from '@/components/AppShell';
import { useApp } from '@/lib/app-context';
import { Globe, Key, Shield, Database } from 'lucide-react';

export default function SettingsPage() {
  const { project, updateProject } = useApp();
  const [activeTab, setActiveTab] = useState('providers');

  const tabs = [
    { id: 'providers', label: 'Providers', icon: Globe },
    { id: 'security', label: 'Safety & Security', icon: Shield },
    { id: 'keys', label: 'API Keys', icon: Key },
    { id: 'storage', label: 'Storage', icon: Database },
  ];

  const toggleProvider = () => {
    updateProject({
      provider: {
        ...project.provider,
        current: project.provider.current === 'fake' ? 'gemini' : 'fake',
      },
    });
  };

  const cycleSafety = () => {
    const modes = ['NORMAL', 'CAREFUL', 'GUARD'] as const;
    const idx = modes.indexOf(project.safetyMode.mode);
    const next = modes[(idx + 1) % 3];
    updateProject({
      safetyMode: { mode: next, reason: next !== 'NORMAL' ? `Manually set to ${next}` : null },
    });
  };

  const toggleFreeze = () => {
    updateProject({
      freezeState: { frozen: !project.freezeState.frozen, reason: !project.freezeState.frozen ? 'Manually frozen from settings' : null },
    });
  };

  return (
    <AppShell breadcrumbs={[{ label: 'Settings' }]}>
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontFamily: 'var(--font-serif)', marginBottom: 4 }}>Settings</h1>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>
            Manage project configuration, providers, and safety controls.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32 }}>
          {/* Tab Nav */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`sidebar-item${activeTab === tab.id ? ' active' : ''}`}>
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div>
            {activeTab === 'providers' && (
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-sans)', marginBottom: 20 }}>Model Provider</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Current: <span style={{ color: 'var(--color-primary)' }}>{project.provider.current}</span></div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {project.provider.current === 'fake' ? 'Using fake/offline provider for development' : 'Connected to Google Gemini API'}
                    </div>
                  </div>
                  <button className="btn btn-secondary" onClick={toggleProvider}>
                    Switch to {project.provider.current === 'fake' ? 'Gemini' : 'Fake'}
                  </button>
                </div>
                {project.provider.current === 'gemini' && !project.provider.geminiConfigured && (
                  <div style={{ padding: 12, borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', fontSize: 13, color: 'var(--color-warning)' }}>
                    ⚠ Gemini API key not configured. Set GEMINI_API_KEY in your .env file.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'security' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="card" style={{ padding: 24 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-sans)', marginBottom: 20 }}>Safety Mode</h2>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Mode: <span style={{
                        color: project.safetyMode.mode === 'NORMAL' ? 'var(--color-success)' :
                          project.safetyMode.mode === 'CAREFUL' ? 'var(--color-warning)' : 'var(--color-error)'
                      }}>{project.safetyMode.mode}</span></div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {project.safetyMode.mode === 'NORMAL' ? 'All operations allowed' :
                          project.safetyMode.mode === 'CAREFUL' ? 'Destructive operations require approval' :
                            'All write/execute operations blocked'}
                      </div>
                    </div>
                    <button className="btn btn-secondary" onClick={cycleSafety}>Change Mode</button>
                  </div>
                </div>
                <div className="card" style={{ padding: 24 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-sans)', marginBottom: 20 }}>Deploy Freeze</h2>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 'var(--radius-md)', border: `1px solid ${project.freezeState.frozen ? 'rgba(239,68,68,0.3)' : 'var(--color-border)'}` }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {project.freezeState.frozen
                          ? <span style={{ color: 'var(--color-error)' }}>🔒 Deploys Frozen</span>
                          : <span style={{ color: 'var(--color-success)' }}>Deploys Enabled</span>
                        }
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {project.freezeState.frozen ? project.freezeState.reason : 'Production deploys are allowed'}
                      </div>
                    </div>
                    <button className={project.freezeState.frozen ? 'btn btn-primary' : 'btn btn-danger'} onClick={toggleFreeze}>
                      {project.freezeState.frozen ? 'Unfreeze' : 'Freeze Deploys'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'keys' && (
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-sans)', marginBottom: 12 }}>API Keys</h2>
                <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>Keys are stored locally and never sent to external servers.</p>
                <div style={{ padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Development Key</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-muted)' }}>ds_live_••••••••••••4e21</div>
                  </div>
                  <button className="btn btn-danger" style={{ fontSize: 12 }}>Revoke</button>
                </div>
              </div>
            )}

            {activeTab === 'storage' && (
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-sans)', marginBottom: 12 }}>Storage & History</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>DStack directory</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>.dstack/</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>Total artifacts</span>
                    <span>{project.artifactCounts.total}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>Stale artifacts</span>
                    <span style={{ color: project.artifactCounts.stale ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>{project.artifactCounts.stale}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
