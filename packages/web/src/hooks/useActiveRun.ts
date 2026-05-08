'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { api, type ShellEvent } from '../lib/api';
import { useSSE } from './useSSE';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001') + '/api';

export function useActiveRun() {
  const [runId, setRunId] = useState<string | null>(null);
  const [currentSkill, setCurrentSkill] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [verdict, setVerdict] = useState<string | null>(null);

  const sseUrl = runId && isRunning ? `${API_BASE}/runs/${runId}/stream` : null;
  const { events, status, clearEvents } = useSSE<ShellEvent>(sseUrl);

  useEffect(() => {
    const last = events[events.length - 1];
    if (!last) return;
    if (last.type === 'complete') {
      setIsRunning(false);
      setVerdict(last.verdict);
    } else if (last.type === 'error') {
      setIsRunning(false);
    }
  }, [events]);

  const startRun = useCallback(
    async (skillName: string, inputs: Record<string, string> = {}, flags?: { dryRun?: boolean; force?: boolean }) => {
      clearEvents();
      setCurrentSkill(skillName);
      setVerdict(null);
      try {
        const { runId: newRunId } = await api.runSkill(skillName, inputs, flags);
        setRunId(newRunId);
        setIsRunning(true);
      } catch (err) {
        console.error('Failed to start run:', err);
        setCurrentSkill(null);
        setIsRunning(false);
      }
    },
    [clearEvents],
  );

  const stopRun = useCallback(async () => {
    if (!runId) return;
    try {
      await api.stopRun(runId);
    } catch { /* ignore */ }
    setIsRunning(false);
    setRunId(null);
  }, [runId]);

  const respondToApproval = useCallback(
    async (decision: 'approve' | 'deny') => {
      if (!runId) return;
      try {
        await api.respondToApproval(runId, decision);
      } catch (err) {
        console.error('Failed to respond to approval:', err);
      }
    },
    [runId],
  );

  const clearRun = useCallback(() => {
    clearEvents();
    setRunId(null);
    setCurrentSkill(null);
    setIsRunning(false);
    setVerdict(null);
  }, [clearEvents]);

  const pendingApproval = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (ev.type === 'approval-required') return ev;
      // If we see a newer tool-call/result after approval, it was already responded to
      if (ev.type === 'tool-result') return null;
    }
    return null;
  }, [events]);

  return {
    runId,
    events,
    isRunning,
    currentSkill,
    verdict,
    status,
    pendingApproval,
    startRun,
    stopRun,
    respondToApproval,
    clearRun,
    // Legacy compat
    isExecuting: status === 'connected',
  };
}
