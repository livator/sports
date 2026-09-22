import 'server-only';

import {
  ApiFootballProvider,
  FootballDataProvider,
  MockProvider,
  ProviderError,
  type SportsDataProvider,
} from '@sports/core';
import { notFound } from 'next/navigation';
import { env } from './env';

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
    case 'api-football':
    default: {
      const apiKey = env.apiFootballKey;
      if (!apiKey) throw new Error('SPORTS_DATA_PROVIDER=api-football needs API_FOOTBALL_KEY');
      return new ApiFootballProvider({ apiKey, requestInit: apiFootballRequestInit });
    }
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

/** The source behind the provider, for crediting it in the footer. */
export function dataSources(): readonly string[] {
  return [getProvider().name];
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
