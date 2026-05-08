'use client';

import React, { useState, useEffect } from 'react';
import { Check, Circle, Play, XCircle } from 'lucide-react';

interface ChainProgressProps {
  chainId: string;
  chain: string[];
}

export default function ChainProgress({ chainId, chain }: ChainProgressProps) {
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [status, setStatus] = useState<'running' | 'complete' | 'error'>('running');

  useEffect(() => {
    const es = new EventSource(`http://localhost:3001/api/chain/${chainId}/stream`);
    
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'skill_start') {
        setCurrentIdx(data.index);
      } else if (data.type === 'chain_complete') {
        setStatus(data.status);
        if (data.status === 'complete') setCurrentIdx(chain.length);
        es.close();
      }
    };

    return () => es.close();
  }, [chainId, chain.length]);

  return (
    <div style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 24, color: 'var(--ink)' }}>Chain Replay</h3>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, left: 24, right: 24, height: 2, background: 'var(--hairline)', zIndex: 0 }} />
        
        {chain.map((skillName, i) => {
          const isComplete = i < currentIdx || (i === currentIdx && status === 'complete');
          const isRunning = i === currentIdx && status === 'running';
          const isError = i === currentIdx && status === 'error';
          const isPending = i > currentIdx;

          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 1 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isComplete ? 'var(--coral)' : isRunning ? 'var(--coral-bg)' : isError ? 'var(--error)' : '#fff',
                border: `2px solid ${isComplete ? 'var(--coral)' : isRunning ? 'var(--coral)' : isError ? 'var(--error)' : 'var(--hairline)'}`,
                color: isComplete || isError ? '#fff' : isRunning ? 'var(--coral)' : 'var(--muted)',
                animation: isRunning ? 'pulse 2s infinite' : 'none',
              }}>
                {isComplete ? <Check size={12} /> : isRunning ? <Play size={10} /> : isError ? <XCircle size={12} /> : <Circle size={8} />}
              </div>
              <div style={{ fontSize: 11, fontWeight: isRunning ? 600 : 500, color: isComplete ? 'var(--ink)' : isRunning ? 'var(--coral)' : 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                /{skillName}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
