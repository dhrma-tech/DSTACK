'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from 'react';
import { api, type ProjectState, type HealthReport } from '../lib/api';

export function useProject() {
  const [project, setProject] = useState<ProjectState | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      const [proj, h] = await Promise.all([
        api.getProject().catch(() => null),
        api.getProjectHealth().catch(() => null),
      ]);
      if (proj) setProject(proj);
      if (h) setHealth(h);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Subscribe to global SSE events for live updates
  useEffect(() => {
    const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001') + '/api';
    const es = new EventSource(`${API_BASE}/events`);
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as { type: string };
        if (
          event.type === 'artifact-saved' ||
          event.type === 'safety-changed' ||
          event.type === 'freeze-changed' ||
          event.type === 'skill-status-changed'
        ) {
          load();
        }
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [load]);

  return { project, health, isLoading, error, reload: load };
}
