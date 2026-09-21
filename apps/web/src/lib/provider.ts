import 'server-only';

import {
  CompositeProvider,
  EspnProvider,
  FootballDataProvider,
  MockProvider,
  TheSportsDbProvider,
  type SportsDataProvider,
} from '@sports/core';
import { env } from './env';
import { tsdbFileStore } from './tsdb-store';

let instance: SportsDataProvider | undefined;

/** Next.js data-cache lifetimes per ESPN endpoint, in seconds. */
function espnRequestInit(url: URL): RequestInit {
  let revalidate = 120; // standings
  if (url.pathname.endsWith('/statistics')) revalidate = 900;
  // Headlines move slowly, and a single article hardly changes once published.
  if (url.pathname.endsWith('/news')) revalidate = 300;
  if (url.pathname.includes('/sports/news/')) revalidate = 900;
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
      // ESPN for everything it covers; TheSportsDB for Romania, Moldova and Ukraine.
      return new CompositeProvider([
        new EspnProvider({ requestInit: espnRequestInit }),
        new TheSportsDbProvider({
          ...(env.theSportsDbApiKey ? { apiKey: env.theSportsDbApiKey } : {}),
          /*
           * Not through the Next.js data cache, unlike ESPN. That cache refreshes stale entries
           * on its own, outside this provider's request budget (the free key allows about 30 a
           * minute), and route handlers wait for those refreshes before answering. The provider
           * keeps its own answers instead, on disk, and refreshes them within the budget.
           */
          requestInit: () => ({ cache: 'no-store' }),
          store: tsdbFileStore,
        }),
      ]);
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

/** Every source behind the provider, for crediting them in the footer. */
export function dataSources(): readonly string[] {
  const provider = getProvider();
  return provider instanceof CompositeProvider ? provider.sources : [provider.name];
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
