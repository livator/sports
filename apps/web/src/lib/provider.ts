import 'server-only';

import {
  EspnProvider,
  FootballDataProvider,
  MockProvider,
  type SportsDataProvider,
} from '@sports/core';
import { env } from './env';

let instance: SportsDataProvider | undefined;

/** Next.js data-cache lifetimes per ESPN endpoint, in seconds. */
function espnRequestInit(url: URL): RequestInit {
  let revalidate = 120; // standings
  if (url.pathname.endsWith('/statistics')) revalidate = 900;
  if (url.pathname.endsWith('/scoreboard')) {
    const dates = url.searchParams.get('dates') ?? '';
    // A single day (or "now") is a live scoreboard; a whole month is a fixture list.
    revalidate = dates.length === 6 ? 300 : 30;
  }
  return { next: { revalidate } } as RequestInit;
}

function create(): SportsDataProvider {
  switch (env.dataProvider) {
    case 'mock':
      return new MockProvider();
    case 'football-data': {
      const apiKey = env.footballDataApiKey;
      if (!apiKey)
        throw new Error('SPORTS_DATA_PROVIDER=football-data needs FOOTBALL_DATA_API_KEY');
      return new FootballDataProvider({
        apiKey,
        requestInit: { next: { revalidate: 60 } } as RequestInit,
      });
    }
    default:
      return new EspnProvider({ requestInit: espnRequestInit });
  }
}

/**
 * Server-side data source. Server components and the /api/v1 routes (used by the
 * browser and by mobile clients) all go through this single instance.
 */
export function getProvider(): SportsDataProvider {
  instance ??= create();
  return instance;
}

export function isDemoData(): boolean {
  return getProvider().name === 'mock';
}

/**
 * Runs a provider call and returns null instead of throwing, so one upstream
 * hiccup degrades a section of the page rather than the whole route.
 */
export async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    console.error('[data]', error instanceof Error ? error.message : error);
    return null;
  }
}
