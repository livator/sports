import 'server-only';

import type { League } from '@sports/core';
import { getProvider } from './provider';

/** How long a competition counts as warm. The data cache itself keeps serving after that. */
const WARM_FOR_MS = 10 * 60_000;
/** Few at a time: this is a courtesy to the data source, not a race. */
const CONCURRENCY = 3;

const warmedAt = new Map<string, number>();

/**
 * Fills the data cache for competitions the visitor is likely to pick next, so the click
 * finds the table, scorers and headlines already there. The first request for a competition
 * costs a second or more at the data source; once cached, Next.js serves it at once and
 * refreshes it in the background.
 *
 * Runs after the response has been sent (see `after()` in the home page), never in its way.
 * Each competition is warmed at most once per ten minutes per server process.
 */
export async function warmCompetitions(leagues: readonly League[], newsCount: number) {
  const now = Date.now();
  const due = leagues.filter((l) => now - (warmedAt.get(l.slug) ?? 0) > WARM_FOR_MS);
  for (const league of due) warmedAt.set(league.slug, now);

  const provider = getProvider();
  const queue = [...due];
  const worker = async () => {
    for (let league = queue.shift(); league; league = queue.shift()) {
      const { slug, hasTable, hasScorers } = league;
      await Promise.allSettled([
        hasTable ? provider.getStandings(slug, { includeForm: false }) : null,
        hasScorers ? provider.getTopScorers(slug, 5) : null,
        provider.getNews ? provider.getNews([slug], newsCount) : null,
      ]);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}
