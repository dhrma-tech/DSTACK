'use client';

import { useState } from 'react';
import {
  FileText, Pencil, Terminal, GitBranch, GitCommit,
  Search, Globe, ChevronDown, ChevronRight,
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';

type GateDecision = 'ALLOW' | 'REQUIRE_APPROVAL' | 'DENY';

interface ToolCallCardProps {
  toolName: string;
  args: Record<string, unknown>;
  gateDecision?: GateDecision;
  result?: {
    output?: string;
    durationMs?: number;
    error?: string;
  } | null;
}

function toolMeta(toolName: string, gate: GateDecision): { borderColor: string; Icon: React.FC<{ size?: number; style?: React.CSSProperties }> } {
  if (gate === 'DENY')             return { borderColor: 'var(--error)', Icon: Terminal };
  if (gate === 'REQUIRE_APPROVAL') return { borderColor: 'var(--amber)', Icon: Terminal };

  if (/read_file|list_files|git_status|git_diff|git_log/.test(toolName))
    return { borderColor: 'var(--hairline)', Icon: toolName.startsWith('git') ? GitBranch : FileText };
  if (/write_file|edit_file/.test(toolName))
    return { borderColor: 'var(--amber)', Icon: Pencil };
  if (/run_command|run_shell/.test(toolName))
    return { borderColor: 'var(--surface-dark)', Icon: Terminal };
  if (/git_commit|git_create_branch/.test(toolName))
    return { borderColor: 'var(--coral)', Icon: GitCommit };
  if (/search_files/.test(toolName))
    return { borderColor: 'var(--hairline)', Icon: Search };
  if (/browser/.test(toolName))
    return { borderColor: 'var(--teal)', Icon: Globe };

  return { borderColor: 'var(--hairline)', Icon: FileText };
}

function truncateArgs(args: Record<string, unknown>): string {
  const str = Object.entries(args)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(' ');
  return str.length > 60 ? str.slice(0, 57) + '…' : str;
}

const isShellTool = (name: string) => /run_command|run_shell/.test(name);
const isScreenshot = (name: string) => /screenshot/.test(name);

export default function ToolCallCard({ toolName, args, gateDecision = 'ALLOW', result }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { borderColor, Icon } = toolMeta(toolName, gateDecision);
  const isDeny = gateDecision === 'DENY';
  const output = result?.output ?? '';
  const lines = output.split('\n');
  const hasMore = lines.length > 3;
  const preview = lines.slice(0, 3).join('\n');

  return (
    <div style={{
      background: isDeny ? '#fdecea' : '#ffffff',
      border: `1px solid ${isDeny ? '#f0b0b0' : 'var(--hairline)'}`,
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 14px' }}>
        <Icon size={13} style={{ color: borderColor === 'var(--hairline)' ? 'var(--muted)' : borderColor, flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--coral)' }}>
          {toolName}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-soft)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {truncateArgs(args)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {result?.durationMs != null && (
            <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
              {result.durationMs}ms
            </span>
          )}
          <Badge variant={gateDecision as BadgeVariant}>{gateDecision}</Badge>
        </div>
      </div>

      {/* Result area */}
      {result != null && (
        <div
          onClick={() => hasMore && setExpanded(e => !e)}
          style={{
            background: isShellTool(toolName) ? 'var(--surface-dark)' : '#f8f7f4',
            color: isShellTool(toolName) ? 'var(--on-dark-soft)' : 'var(--body)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            padding: '10px 14px',
            borderTop: `1px solid ${isShellTool(toolName) ? '#2a2825' : 'var(--hairline)'}`,
            cursor: hasMore ? 'pointer' : 'default',
          }}
        >
          {isScreenshot(toolName) && output.endsWith('.png') ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/browser/screenshots/${output.split('/').pop()}`}
                alt="screenshot"
                style={{ width: '100%', borderRadius: '0 0 8px 8px', display: 'block' }}
              />
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 4 }}>{output}</span>
            </div>
          ) : (
            <>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {expanded ? output : preview}
              </pre>
              {hasMore && !expanded && (
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)', fontSize: 11 }}>
                  <ChevronRight size={12} /> and {lines.length - 3} more lines
                </div>
              )}
              {hasMore && expanded && (
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)', fontSize: 11 }}>
                  <ChevronDown size={12} /> collapse
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
