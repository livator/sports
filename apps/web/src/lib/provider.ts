import 'server-only';

import { FootballDataProvider, MockProvider, type SportsDataProvider } from '@sports/core';
import { env } from './env';

let instance: SportsDataProvider | undefined;

/**
 * Server-side data source. Uses football-data.org when an API key is configured,
 * otherwise the deterministic demo provider. Both server components and the
 * /api/v1 routes (consumed by mobile) go through this single instance.
 */
export function getProvider(): SportsDataProvider {
  if (instance) return instance;
  const apiKey = env.footballDataApiKey;
  instance = apiKey
    ? new FootballDataProvider({
        apiKey,
        // Cache upstream responses at the Next.js data-cache layer.
        requestInit: { next: { revalidate: 60 } } as RequestInit,
      })
    : new MockProvider();
  return instance;
}

export function isDemoData(): boolean {
  return getProvider().name === 'mock';
}
