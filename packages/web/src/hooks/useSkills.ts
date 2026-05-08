'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from 'react';
import { api, type SkillSummary } from '../lib/api';

export function useSkills() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getSkills();
      setSkills(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  // Subscribe to skill-status-changed SSE events
  useEffect(() => {
    const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001') + '/api';
    const es = new EventSource(`${API_BASE}/events`);
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as { type: string };
        if (event.type === 'artifact-saved' || event.type === 'skill-status-changed') {
          load();
        }
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [load]);

  const readySkills = skills.filter((s) => s.available && !s.isBlocked);
  const blockedSkills = skills.filter((s) => !s.available || s.isBlocked);

  return { skills, readySkills, blockedSkills, isLoading, error, reload: load };
}
