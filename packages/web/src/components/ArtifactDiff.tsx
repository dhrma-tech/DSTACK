'use client';

import React from 'react';
import { GitCompare, Plus, Minus } from 'lucide-react';

interface ArtifactDiffProps {
  v1: any;
  v2: any;
  semanticSummary?: string;
}

export default function ArtifactDiff({ v1, v2, semanticSummary }: ArtifactDiffProps) {
  // A simple stringified compare for demonstration
  // In a real impl, we'd use a deep object diffing library like `diff`
  const str1 = JSON.stringify(v1?.content || v1 || {}, null, 2).split('\n');
  const str2 = JSON.stringify(v2?.content || v2 || {}, null, 2).split('\n');
  
  // Very naive line-by-line comparison
  const lines: Array<{ type: 'added' | 'removed' | 'unchanged'; value: string; num1?: number; num2?: number }> = [];
  
  let i = 0, j = 0;
  while (i < str1.length || j < str2.length) {
    if (i < str1.length && j < str2.length && str1[i] === str2[j]) {
      lines.push({ type: 'unchanged', value: str1[i], num1: i + 1, num2: j + 1 });
      i++; j++;
    } else if (i < str1.length && !str2.includes(str1[i])) {
      lines.push({ type: 'removed', value: str1[i], num1: i + 1 });
      i++;
    } else if (j < str2.length) {
      lines.push({ type: 'added', value: str2[j], num2: j + 1 });
      j++;
    } else {
      break;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {semanticSummary && (
        <div style={{
          background: 'var(--coral-bg)', border: '1px solid #f0c4b3',
          padding: '12px 16px', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <GitCompare size={16} style={{ color: 'var(--coral)', marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--coral)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Change Intelligence
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink)' }}>{semanticSummary}</div>
          </div>
        </div>
      )}

      <div style={{
        flex: 1, background: 'var(--surface-dark)', border: '1px solid var(--hairline)',
        borderRadius: 8, overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12,
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {lines.map((line, idx) => {
              const bg = line.type === 'added' ? 'rgba(46, 125, 50, 0.15)' : 
                         line.type === 'removed' ? 'rgba(211, 47, 47, 0.15)' : 'transparent';
              const color = line.type === 'added' ? '#4caf50' : 
                            line.type === 'removed' ? '#f44336' : 'var(--on-dark-soft)';
              
              return (
                <tr key={idx} style={{ background: bg, color: 'var(--on-dark)' }}>
                  <td style={{ width: 40, padding: '0 8px', color: 'var(--on-dark-soft)', userSelect: 'none', textAlign: 'right', borderRight: '1px solid #333' }}>
                    {line.num1 || ''}
                  </td>
                  <td style={{ width: 40, padding: '0 8px', color: 'var(--on-dark-soft)', userSelect: 'none', textAlign: 'right', borderRight: '1px solid #333' }}>
                    {line.num2 || ''}
                  </td>
                  <td style={{ width: 24, padding: '0 8px', color }}>
                    {line.type === 'added' ? <Plus size={10} /> : line.type === 'removed' ? <Minus size={10} /> : null}
                  </td>
                  <td style={{ padding: '0 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {line.value}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
