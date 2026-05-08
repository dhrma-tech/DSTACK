'use client';

import { Activity } from 'lucide-react';
import { useHealthPulse } from '@/hooks/useHealthPulse';

export default function HealthPulse() {
  const { health, loading } = useHealthPulse();

  if (loading || !health) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 10,
        background: 'var(--canvas)', border: '1px solid var(--hairline)',
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          background: 'var(--canvas)', border: '2px solid var(--hairline)',
        }} />
        <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          —
        </span>
      </div>
    );
  }

  const score = health.score;
  const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--error)';
  const bgColor = score >= 80 ? '#edf7ee' : score >= 60 ? '#fff8e8' : '#fdecea';
  const borderColor = score >= 80 ? '#b2d9b5' : score >= 60 ? '#e8c97a' : '#f0b0b0';

  // SVG circular progress
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 10,
        background: bgColor, border: `1px solid ${borderColor}`,
        cursor: 'default', position: 'relative',
        transition: 'all 0.3s ease',
      }}
      title={`Health: ${score}/100 — ${health.status}\n${health.recommendations?.[0] ?? ''}`}
    >
      {/* Circular progress ring */}
      <div style={{ position: 'relative', width: 22, height: 22, flexShrink: 0 }}>
        <svg width="22" height="22" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="11" cy="11" r={radius}
            fill="none" stroke={borderColor} strokeWidth="2.5"
          />
          <circle
            cx="11" cy="11" r={radius}
            fill="none" stroke={color} strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <Activity size={10} style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          color,
        }} />
      </div>

      {/* Score */}
      <span style={{
        fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)',
        color,
      }}>
        {score}
      </span>

      {/* Top recommendation (if any) */}
      {health.recommendations?.[0] && (
        <span style={{
          fontSize: 10, color: 'var(--muted)', maxWidth: 140,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          display: 'none', // hidden on small widths; CSS media query would show
        }}>
          {health.recommendations[0]}
        </span>
      )}
    </div>
  );
}
