import { LEAGUES } from './leagues';
import type { Match } from './types';
import { isLive } from './utils/format';

const hasScore = (m: Match) => isLive(m.status) || m.status === 'finished';
const keyOf = (m: Match) => `${m.leagueSlug}:${m.id}`;

/**
 * Order for a "latest results" strip: the freshest match of each competition first, in
 * display order, then everything else. Live beats finished, today beats yesterday, and a
 * later kick-off beats an earlier one. Matches without a score are left out.
 */
export function latestResults(today: Match[], yesterday: Match[] = []): Match[] {
  const ranked = [
    ...today.filter(hasScore).map((match) => ({ match, day: 0 })),
    ...yesterday.filter(hasScore).map((match) => ({ match, day: 1 })),
  ]
    .sort(
      (a, b) =>
        Number(!isLive(a.match.status)) - Number(!isLive(b.match.status)) ||
        a.day - b.day ||
        b.match.kickoff.localeCompare(a.match.kickoff),
    )
    .map((entry) => entry.match);

  const heads = LEAGUES.map((l) => ranked.find((m) => m.leagueSlug === l.slug)).filter(
    (m): m is Match => m !== undefined,
  );
  const taken = new Set(heads.map(keyOf));
  return [...heads, ...ranked.filter((m) => !taken.has(keyOf(m)))];
}
