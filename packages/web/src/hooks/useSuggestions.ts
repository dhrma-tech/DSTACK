'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, type WorkflowSuggestion } from '@/lib/api';

export function useSuggestions(refreshKey?: number) {
  const [suggestions, setSuggestions] = useState<WorkflowSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  // `loading` covers the first load only; background refreshes keep showing the current list.
  const refresh = useCallback(() => {
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
