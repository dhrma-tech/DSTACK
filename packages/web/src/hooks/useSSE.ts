'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback, useRef } from 'react';

export function useSSE<T>(url: string | null) {
  const [events, setEvents] = useState<T[]>([]);
  const [status, setStatus] = useState<'idle' | 'connected' | 'error' | 'completed'>('idle');
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setStatus('idle');
  }, []);

  useEffect(() => {
    if (!url) {
      setStatus('idle');
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const es = new EventSource(url);
      esRef.current = es;
      setStatus('connected');

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as T & { type?: string };
          setEvents((prev) => [...prev, data]);
          if (data.type === 'complete' || data.type === 'error') {
            setStatus('completed');
            es.close();
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        if (!cancelled) {
          setStatus('error');
          reconnectTimer.current = setTimeout(() => {
            if (!cancelled) connect();
          }, 3000);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [url]);

  return { events, status, clearEvents, connected: status === 'connected' };
}
