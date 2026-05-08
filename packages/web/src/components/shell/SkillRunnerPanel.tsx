'use client';

import { useState } from 'react';
import { X, HelpCircle } from 'lucide-react';
import type { SkillSummary } from '@/lib/api';
import TemplateManager from '../TemplateManager';
import SkillDocPanel from '../SkillDocPanel';

interface SkillRunnerPanelProps {
  skill: SkillSummary;
  onClose: () => void;
  onRun: (skillName: string, inputs: Record<string, string>, flags: { dryRun: boolean; force: boolean; model: string }) => void;
}

export default function SkillRunnerPanel({ skill, onClose, onRun }: SkillRunnerPanelProps) {
  const [dryRun, setDryRun] = useState(false);
  const [force, setForce] = useState(false);
  const [model, setModel] = useState<'flash' | 'pro' | 'custom'>('flash');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [showDocs, setShowDocs] = useState(false);

  const handleRun = () => {
    onRun(skill.name, inputs, { dryRun, force, model });
  };

  return (
    <div style={{
      background: '#ffffff', border: '1px solid var(--hairline)',
      borderTopLeftRadius: 12, borderTopRightRadius: 12,
      padding: 16, animation: 'slideUp 0.2s ease-out',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: 'var(--coral)' }}>
            /{skill.name}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'var(--canvas)', border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
            {skill.model.includes('pro') || skill.model.includes('2.5') ? 'Pro' : 'Flash'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TemplateManager 
            skillName={skill.name} 
            currentInputs={inputs} 
            currentFlags={{ dryRun, force, model }} 
            onLoadTemplate={(newInputs, newFlags) => {
              setInputs(newInputs);
              if (newFlags.dryRun !== undefined) setDryRun(newFlags.dryRun as boolean);
              if (newFlags.force !== undefined) setForce(newFlags.force as boolean);
              if (newFlags.model) setModel(newFlags.model as 'flash' | 'pro' | 'custom');
            }} 
          />
          <button onClick={() => setShowDocs(!showDocs)} style={{ background: showDocs ? 'var(--coral-bg)' : 'transparent', border: 'none', cursor: 'pointer', color: showDocs ? 'var(--coral)' : 'var(--muted)', display: 'flex', padding: 4, borderRadius: 4 }}>
            <HelpCircle size={16} />
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {showDocs && <SkillDocPanel skill={skill} />}

      {/* Prerequisites */}
      {skill.requiresArtifacts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)', marginBottom: 6 }}>
            Prerequisites
          </div>
          {skill.requiresArtifacts.map(req => (
            <div key={req} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 28 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted-soft)', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--body)' }}>/{req}</span>
            </div>
          ))}
        </div>
      )}

      {/* Toggles */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <Toggle label="Dry run" value={dryRun} onChange={setDryRun} />
        <Toggle
          label="Force override"
          value={force}
          onChange={setForce}
          dangerText={force ? 'Stage gates bypassed' : undefined}
        />
      </div>

      {/* Model selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {(['flash', 'pro', 'custom'] as const).map(m => (
          <button
            key={m}
            onClick={() => setModel(m)}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 12px',
              borderRadius: 6, cursor: 'pointer',
              background: model === m ? 'var(--coral-bg)' : 'var(--canvas)',
              border: `1px solid ${model === m ? 'var(--coral)' : 'var(--hairline)'}`,
              color: model === m ? 'var(--coral)' : 'var(--muted)',
            }}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        style={{
          width: '100%', height: 40, borderRadius: 8,
          background: 'var(--coral)', color: '#fff',
          border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}
      >
        Run /{skill.name}
      </button>
      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
        ⌘↵ to run
      </p>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function Toggle({ label, value, onChange, dangerText }: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  dangerText?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 28, height: 16, borderRadius: 8, border: 'none', cursor: 'pointer', padding: 0,
          background: value ? 'var(--coral)' : 'var(--hairline)',
          position: 'relative', transition: 'background 0.15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: value ? 14 : 2, width: 12, height: 12,
          borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
        }} />
      </button>
      <span style={{ fontSize: 12, color: 'var(--body)' }}>{label}</span>
      {dangerText && <span style={{ fontSize: 11, color: 'var(--error)' }}>{dangerText}</span>}
    </div>
  );
}
