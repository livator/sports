import 'server-only';

import type { League } from '@sports/core';
import { getProvider } from './provider';

/**
 * How long a competition counts as warm. Deliberately longer than the cache lifetimes this
 * warms (standings 5 minutes, scorers 15): once an entry exists, Next.js serves it at once and
 * refreshes it in the background, so re-warming buys nothing and only spends the upstream
 * budget. What warming is for is the cold first fetch, which costs a second or more.
 */
const WARM_FOR_MS = 30 * 60_000;
/**
 * How many competitions one visit may warm. `leagues` arrives in the order a visitor is most
 * likely to click, so the ones past this are the long tail; they load on demand. Without a cap,
 * a single home view with no filter warmed all 25 competitions — two requests each, several
 * thousand a day at a trickle of traffic.
 */
const WARM_LIMIT = 6;
/** Few at a time: this is a courtesy to the data source, not a race. */
const CONCURRENCY = 3;

const warmedAt = new Map<string, number>();

/**
 * Fills the data cache for competitions the visitor is likely to pick next, so the click
 * finds the table and scorers already there. The first request for a competition costs a
 * second or more at the data source; once cached, Next.js serves it at once and refreshes it
 * in the background. News is not warmed here: the home page's news list is the same general
 * mix regardless of which competition is selected, so there is nothing per-league to warm.
 *
 * Runs after the response has been sent (see `after()` in the home page), never in its way.
 * `leagues` is in priority order; only the first `WARM_LIMIT` of those still due are fetched.
 */
export async function warmCompetitions(leagues: readonly League[]) {
  const now = Date.now();
  const due = leagues
    .filter((l) => now - (warmedAt.get(l.slug) ?? 0) > WARM_FOR_MS)
    .slice(0, WARM_LIMIT);
  for (const league of due) warmedAt.set(league.slug, now);

  const provider = getProvider();
  const queue = [...due];
  const worker = async () => {
    for (let league = queue.shift(); league; league = queue.shift()) {
      const { slug, hasTable, hasScorers } = league;
      await Promise.allSettled([
        hasTable ? provider.getStandings(slug, { includeForm: false }) : null,
        hasScorers ? provider.getTopScorers(slug, 5) : null,
      ]);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}
