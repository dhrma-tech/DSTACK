'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface JsonViewerProps {
  data: any;
  title?: string;
}

export default function JsonViewer({ data, title }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-window" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="code-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="dot" style={{ backgroundColor: '#ff5f56' }} />
          <div className="dot" style={{ backgroundColor: '#ffbd2e' }} />
          <div className="dot" style={{ backgroundColor: '#27c93f' }} />
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', marginLeft: 8, color: 'var(--color-text-secondary)' }}>
            {title || 'artifact.json'}
          </span>
        </div>
        <button 
          onClick={handleCopy}
          className="btn-ghost" 
          style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="code-content" style={{ flex: 1, overflow: 'auto', backgroundColor: 'var(--color-surface)' }}>
        <pre style={{ margin: 0, fontSize: 13, color: 'var(--color-text-primary)' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}
