/**
 * A small fixed-window request limiter, per client address. It lives in the memory of one
 * server process, which fits how this app is run (a single `next start`). Behind several
 * instances each would count on its own; put a shared limiter in the proxy for that.
 *
 * It is here for two reasons. The public API and the pages fan out to data sources that are
 * themselves rate limited, so one client hammering us would spend that budget for everyone.
 * And forms that write (comments, votes, views, log in) should not be scriptable at full speed.
 */

export interface Limit {
  /** Requests allowed per window. */
  max: number;
  windowMs: number;
}

export const LIMITS = {
  /** Reading pages: generous, a person clicking fast never gets near it. */
  page: { max: 300, windowMs: 60_000 },
  /** Reading the API. The site's own polling is a handful of requests a minute. */
  apiRead: { max: 240, windowMs: 60_000 },
  /** Anything that writes. better-auth has its own, stricter limits on top for log in. */
  apiWrite: { max: 40, windowMs: 60_000 },
} as const satisfies Record<string, Limit>;

const MAX_TRACKED = 20_000;
const counters = new Map<string, { count: number; resetAt: number }>();

export interface Verdict {
  allowed: boolean;
  /** Seconds until the window resets, for Retry-After. */
  retryAfter: number;
}

export function take(key: string, limit: Limit, now = Date.now()): Verdict {
  let counter = counters.get(key);
  if (!counter || counter.resetAt <= now) {
    // A flood of distinct addresses must not grow this map without bound.
    if (counters.size >= MAX_TRACKED) {
      for (const [k, c] of counters) if (c.resetAt <= now) counters.delete(k);
      if (counters.size >= MAX_TRACKED) counters.clear();
    }
    counter = { count: 0, resetAt: now + limit.windowMs };
    counters.set(key, counter);
  }
  counter.count++;
  return {
    allowed: counter.count <= limit.max,
    retryAfter: Math.max(1, Math.ceil((counter.resetAt - now) / 1000)),
  };
}

/**
 * The address to count by. Set CLIENT_IP_HEADER to the header your proxy or CDN fills in
 * (for example `cf-connecting-ip`). Otherwise `x-real-ip`, then the last entry of
 * `x-forwarded-for`, which is the one added by the nearest proxy rather than by the client.
 *
 * Without a proxy in front that overwrites these headers, a client can send its own and dodge
 * the limit. Run the app behind one.
 */
export function clientAddress(headers: Headers): string {
  const named = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  const direct = (named && headers.get(named)) || headers.get('x-real-ip');
  if (direct) return direct.trim();
  const forwarded = headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  return forwarded || 'unknown';
}
