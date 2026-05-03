'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import { useSSE } from './useSSE';

export function useActiveRun() {
  const [runId, setRunId] = useState<string | null>(null);
  const { events, status, clearEvents } = useSSE<any>(
    runId ? `http://localhost:3001/api/runs/${runId}/stream` : null
  );

  const startRun = useCallback(async (skillName: string, args: Record<string, string> = {}) => {
    clearEvents();
    try {
      const { runId: newRunId } = await apiClient.runSkill(skillName, args);
      setRunId(newRunId);
    } catch (err) {
      console.error('Failed to start run:', err);
    }
  }, [clearEvents]);

  const respondToApproval = useCallback(async (decision: 'approve' | 'deny') => {
    if (!runId) return;
    try {
      await apiClient.respondToApproval(runId, decision);
    } catch (err) {
      console.error('Failed to respond to approval:', err);
    }
  }, [runId]);

  return {
    runId,
    events,
    status,
    startRun,
    respondToApproval,
    isExecuting: status === 'connected'
  };
}
