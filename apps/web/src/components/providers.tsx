'use client';

import { HttpProvider } from '@sports/core';
import { SportsProvider } from '@sports/query';
import { useState, type ReactNode } from 'react';

/**
 * Client-side data access goes through the app's own /api/v1 routes,
 * exactly like the mobile apps will. Server components call the provider directly.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [provider] = useState(
    () =>
      new HttpProvider({
        baseUrl:
          typeof window !== 'undefined'
            ? window.location.origin
            : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
      }),
  );
  return <SportsProvider provider={provider}>{children}</SportsProvider>;
}
