import { ProviderError, findLeague, type League } from '@sports/core';
import { NextResponse } from 'next/server';

export const API_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, { ...init, headers: { ...API_CACHE_HEADERS, ...init?.headers } });
}

export function error(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Resolves a league from a route param or returns a 404 response. */
export function resolveLeague(slug: string): League | NextResponse {
  return findLeague(slug) ?? error(`Unknown league "${slug}"`, 404);
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

/** Wraps a handler so provider failures become clean JSON errors. */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ProviderError) {
      const status = err.status && err.status >= 400 && err.status < 600 ? 502 : 500;
      return error(err.message, status);
    }
    console.error(err);
    return error('Internal error', 500);
  }
}

export function intParam(value: string | null, fallback: number, max = 100): number {
  const n = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(n) || n < 1) return fallback;
  return Math.min(n, max);
}

export function dateParam(value: string | null): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}
