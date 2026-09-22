import 'server-only';

import {
  ApiFootballProvider,
  CompositeProvider,
  EspnProvider,
  FootballDataProvider,
  MockProvider,
  ProviderError,
  TheSportsDbProvider,
  type SportsDataProvider,
} from '@sports/core';
import { notFound } from 'next/navigation';
import { env } from './env';
import { tsdbFileStore } from './tsdb-store';

let instance: SportsDataProvider | undefined;

/** Seconds a single day's scoreboard ("YYYYMMDD", or empty for now) may be reused. */
function scoreboardLifetime(dates: string): number {
  if (dates.length !== 8) return 30;
  const day = Date.UTC(+dates.slice(0, 4), +dates.slice(4, 6) - 1, +dates.slice(6, 8));
  const daysFromNow = (day - Date.now()) / 86_400_000;
  // Yesterday through tomorrow, whatever the viewer's timezone: results and kick-offs move.
  if (daysFromNow > -2.5 && daysFromNow < 2) return 30;
  return daysFromNow < 0 ? 6 * 60 * 60 : 15 * 60;
}

/** Next.js data-cache lifetimes per ESPN endpoint, in seconds. */
function espnRequestInit(url: URL): RequestInit {
  let revalidate = 120; // standings
  if (url.pathname.endsWith('/statistics')) revalidate = 900;
  // Headlines move slowly, and a single article hardly changes once published.
  if (url.pathname.endsWith('/news')) revalidate = 300;
  if (url.pathname.includes('/sports/news/')) revalidate = 900;
  if (url.pathname.endsWith('/scoreboard')) {
    const dates = url.searchParams.get('dates') ?? '';
    // A whole month is a fixture list. A single day is a live scoreboard only around today:
    // a day that is over hardly changes, and fixtures days away change rarely. Keeping those
    // longer is most of what makes flipping through days quick.
    revalidate = dates.length === 6 ? 300 : scoreboardLifetime(dates);
  }
  return { next: { revalidate } } as RequestInit;
}

/** Next.js data-cache lifetimes per api-football endpoint, in seconds. */
function apiFootballRequestInit(url: URL): RequestInit {
  let revalidate = 300; // standings, fixture lists by round or date range
  if (url.pathname.endsWith('/leagues') || url.pathname.endsWith('/fixtures/rounds')) {
    revalidate = 6 * 60 * 60; // season metadata, hardly changes intra-day
  } else if (url.pathname.endsWith('/players/topscorers')) {
    revalidate = 900;
  } else if (url.pathname.endsWith('/headtohead')) {
    revalidate = 6 * 60 * 60; // past meetings; one more is added only once in a while
  } else if (url.pathname.endsWith('/predictions')) {
    revalidate = 60 * 60; // settled well before kick-off; team news can still shift it
  } else if (url.pathname.endsWith('/teams')) {
    revalidate = 6 * 60 * 60; // club info and venue, essentially static
  } else if (url.pathname.endsWith('/players')) {
    revalidate = 900; // squad list and season stats
  } else if (url.pathname.endsWith('/fixtures') && url.searchParams.has('id')) {
    revalidate = 30; // a single match, possibly live
  } else if (url.pathname.endsWith('/fixtures') && url.searchParams.has('team')) {
    revalidate = 900; // recent form for a match's head-to-head panel
  } else if (url.pathname.endsWith('/fixtures') && url.searchParams.has('date')) {
    revalidate = scoreboardLifetime(url.searchParams.get('date')?.replaceAll('-', '') ?? '');
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
    case 'api-football': {
      const apiKey = env.apiFootballKey;
      if (!apiKey) throw new Error('SPORTS_DATA_PROVIDER=api-football needs API_FOOTBALL_KEY');
      return new ApiFootballProvider({ apiKey, requestInit: apiFootballRequestInit });
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
/**
 * Like `safe`, for a single match, team or player named in the address. "The source has no
 * such thing" (or rejects the id as malformed) is a missing page, so it becomes a real 404;
 * anything else is a hiccup and still degrades to a notice on the page.
 */
export async function safeOrNotFound<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ProviderError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    console.error('[data]', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    console.error('[data]', error instanceof Error ? error.message : error);
    return null;
  }
}
