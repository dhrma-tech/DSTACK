'use client';

import { Sparkles, ChevronRight, AlertTriangle, Play } from 'lucide-react';
import type { WorkflowSuggestion } from '@/lib/api';

interface SuggestionBannerProps {
  suggestions: WorkflowSuggestion[];
  loading: boolean;
  onRunSkill?: (skillName: string) => void;
  compact?: boolean;
}

const CATEGORY_STYLES: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  critical:    { bg: '#fdecea', border: '#f0b0b0', dot: 'var(--error)', label: 'Critical' },
  recommended: { bg: 'var(--coral-bg)', border: '#f0c4b3', dot: 'var(--coral)', label: 'Recommended' },
  optional:    { bg: '#f0f5ff', border: '#a3b8f0', dot: '#5b7dc4', label: 'Optional' },
};

export default function SuggestionBanner({ suggestions, loading, onRunSkill, compact }: SuggestionBannerProps) {
  if (loading || suggestions.length === 0) return null;

  if (compact) {
    const top = suggestions[0];
    const style = CATEGORY_STYLES[top.category] ?? CATEGORY_STYLES.optional;
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px', background: style.bg,
          borderBottom: `1px solid ${style.border}`,
          fontSize: 13,
        }}
      >
        <Sparkles size={14} style={{ color: style.dot, flexShrink: 0 }} />
        <span style={{ color: 'var(--ink)', fontWeight: 500 }}>
          Next: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--coral)' }}>/{top.skill}</span>
        </span>
        <span style={{ color: 'var(--muted)', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {top.reason}
        </span>
        {onRunSkill && (
          <button
            onClick={() => onRunSkill(top.skill)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--coral)', color: '#fff',
              border: 'none', borderRadius: 6, padding: '4px 12px',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
            }}
          >
            <Play size={10} /> Run
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Sparkles size={14} style={{ color: 'var(--coral)' }} />
        <span style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.8px', color: 'var(--coral)',
        }}>
          Suggested Next
        </span>
      </div>

      {suggestions.slice(0, 4).map((s, i) => {
        const style = CATEGORY_STYLES[s.category] ?? CATEGORY_STYLES.optional;
        return (
          <div
            key={s.skill}
            style={{
              background: '#fff', border: `1px solid ${style.border}`,
              borderRadius: 10, padding: '10px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
              animation: `fadeInUp 0.3s ease-out ${i * 0.05}s both`,
            }}
          >
            {/* Priority indicator */}
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: style.bg, border: `1.5px solid ${style.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, color: style.dot, flexShrink: 0,
              marginTop: 1,
            }}>
              {s.priority}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--coral)',
                }}>
                  /{s.skill}
                </span>
                <span style={{
                  fontSize: 9, padding: '1px 6px', borderRadius: 9999,
                  background: style.bg, border: `1px solid ${style.border}`,
                  color: style.dot, fontWeight: 500, textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}>
                  {style.label}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--body)', lineHeight: 1.5, margin: 0 }}>
                {s.reason}
              </p>
              {s.risk && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 4 }}>
                  <AlertTriangle size={11} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>
                    {s.risk}
                  </span>
                </div>
              )}
            </div>

            {/* Run button */}
            {onRunSkill && (
              <button
                onClick={() => onRunSkill(s.skill)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'var(--coral)', color: '#fff',
                  border: 'none', borderRadius: 6, padding: '6px 14px',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--coral-active)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--coral)')}
              >
                <Play size={11} /> Run
                <ChevronRight size={11} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
