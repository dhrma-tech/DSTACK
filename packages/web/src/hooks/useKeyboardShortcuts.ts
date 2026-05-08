'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ShortcutHandlers {
  onOpenPalette?: () => void;
  onRunSelected?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}) {
  const router = useRouter();

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      switch (e.key) {
        case 'k':
          e.preventDefault();
          handlers.onOpenPalette?.();
          break;
        case 'Enter':
          e.preventDefault();
          handlers.onRunSelected?.();
          break;
        case 'l':
          e.preventDefault();
          router.push('/runs');
          break;
        case 'a':
          e.preventDefault();
          router.push('/artifacts');
          break;
        case ',':
          e.preventDefault();
          router.push('/settings');
          break;
        case '/':
          e.preventDefault();
          // Show shortcut overlay — handled at component level
          break;
      }
    };

    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [handlers, router]);
}
