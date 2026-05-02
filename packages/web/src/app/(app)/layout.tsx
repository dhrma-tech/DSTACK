'use client';

import React from 'react';
import { AppProvider } from '@/lib/app-context';

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      {children}
    </AppProvider>
  );
}
