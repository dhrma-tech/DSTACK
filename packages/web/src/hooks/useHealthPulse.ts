'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, type HealthReport } from '@/lib/api';

export function useHealthPulse() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    api.getProjectHealth()
      .then(setHealth)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, [refresh]);

  return { health, loading, refresh };
}
