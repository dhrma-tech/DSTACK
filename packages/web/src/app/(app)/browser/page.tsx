'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api, type ScreenshotAsset } from '@/lib/api';
import { useApp } from '@/lib/app-context';

export default function BrowserQAPage() {
  const { artifacts } = useApp();
  const [screenshots, setScreenshots] = useState<ScreenshotAsset[]>([]);
  const [selected, setSelected] = useState<ScreenshotAsset | null>(null);

  useEffect(() => {
    api.getScreenshots().then(setScreenshots).catch(() => null);
  }, []);

  const qaArtifact = artifacts.find(a => a.skillName === 'qa' && a.isLatest);

  return (
    <AppShell>
      <div style={{ height: '100%', overflowY: 'auto', padding: 24, background: 'var(--canvas)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, marginBottom: 20 }}>Browser / QA</h1>
        {qaArtifact ? (
          <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Latest QA Report</h2>
            <p style={{ fontSize: 13, color: 'var(--body)' }}>{qaArtifact.summary}</p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, padding: 20, marginBottom: 24, fontSize: 13, color: 'var(--muted)' }}>
            No QA report yet. Run <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--coral)' }}>/qa</span> to generate one.
          </div>
        )}
        <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Screenshots</h2>
        {screenshots.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No screenshots captured yet.</p>
        )}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {screenshots.map(shot => (
            <div
              key={shot.filename}
              onClick={() => setSelected(shot === selected ? null : shot)}
              style={{ width: 160, cursor: 'pointer', border: `1px solid ${shot === selected ? 'var(--coral)' : 'var(--hairline)'}`, borderRadius: 8, overflow: 'hidden', background: '#fff' }}
            >
              <div style={{ height: 100, background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--muted)' }}>
                screenshot
              </div>
              <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shot.filename}</span>
                {shot.hasErrors && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 9999, background: '#fdecea', color: 'var(--error)', flexShrink: 0 }}>ERR</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
