'use client';

import { useState, useEffect, useCallback } from 'react';

export function useSSE<T>(url: string | null) {
  const [events, setEvents] = useState<T[]>([]);
  const [status, setStatus] = useState<'idle' | 'connected' | 'error' | 'completed'>('idle');

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    if (!url) return;

    setStatus('connected');
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setEvents((prev) => [...prev, data]);
        if (data.type === 'complete') {
          setStatus('completed');
          eventSource.close();
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      setStatus('error');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [url]);

  return { events, status, clearEvents };
}
