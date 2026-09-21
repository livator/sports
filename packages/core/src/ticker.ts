import { LEAGUES } from './leagues';
import type { CompetitionCategory, League, Match } from './types';

const keyOf = (m: Match) => `${m.leagueSlug}:${m.id}`;

export interface LatestResultsOptions {
  /**
   * Which competitions may appear. Defaults to the top five leagues: a results strip is small,
   * and twenty-odd competitions would bury the scores most visitors came for.
   * Pass `'all'` to lift the limit.
   */
  categories?: readonly CompetitionCategory[] | 'all';
}

const DEFAULT_CATEGORIES: readonly CompetitionCategory[] = ['top5'];

/** The competitions a results strip draws on, in display order. */
export function resultsLeagues(options: LatestResultsOptions = {}): League[] {
  const categories = options.categories ?? DEFAULT_CATEGORIES;
  return categories === 'all'
    ? [...LEAGUES]
    : LEAGUES.filter((l) => categories.includes(l.category));
}

/**
 * Order for a "latest results" strip: finished matches only, the most recent one of each
 * competition first, in display order, then everything else, newest first. Matches still
 * being played are left out: a result is a final score, and live games have their own place
 * on the scoreboard. Give it as many days of matches as the strip should reach back.
 */
export function latestResults(matches: Match[], options: LatestResultsOptions = {}): Match[] {
  const leagues = resultsLeagues(options);
  const allowed = new Set(leagues.map((l) => l.slug));
  const ranked = matches
    .filter((m) => m.status === 'finished' && allowed.has(m.leagueSlug))
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff));

  const heads = leagues
    .map((l) => ranked.find((m) => m.leagueSlug === l.slug))
    .filter((m): m is Match => m !== undefined);
  const taken = new Set(heads.map(keyOf));
  return [...heads, ...ranked.filter((m) => !taken.has(keyOf(m)))];
}
