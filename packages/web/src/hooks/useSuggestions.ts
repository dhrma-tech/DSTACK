'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, type WorkflowSuggestion } from '@/lib/api';

export function useSuggestions(refreshKey?: number) {
  const [suggestions, setSuggestions] = useState<WorkflowSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    api.getWorkflowSuggestions()
      .then(data => setSuggestions(data.suggestions))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [refresh, refreshKey]);

  return { suggestions, loading, refresh };
}
