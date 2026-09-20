'use client';

import type { SportsDataProvider } from '@sports/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';

const SportsDataContext = createContext<SportsDataProvider | null>(null);

export interface SportsProviderProps {
  provider: SportsDataProvider;
  /** Supply your own client to share it with other queries in the host app. */
  queryClient?: QueryClient;
  children: ReactNode;
}

export function createSportsQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  });
}

/**
 * Wrap your app once. Web passes a server-backed provider or `HttpProvider`;
 * React Native passes `HttpProvider` pointing at the deployed web app.
 */
export function SportsProvider({ provider, queryClient, children }: SportsProviderProps) {
  const [client] = useState(() => queryClient ?? createSportsQueryClient());
  return (
    <QueryClientProvider client={client}>
      <SportsDataContext.Provider value={provider}>{children}</SportsDataContext.Provider>
    </QueryClientProvider>
  );
}

export function useSportsData(): SportsDataProvider {
  const provider = useContext(SportsDataContext);
  if (!provider) throw new Error('useSportsData must be used inside <SportsProvider>');
  return provider;
}
