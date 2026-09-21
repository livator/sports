import { describe, expect, it } from 'vitest';
import { latestResults, resultsLeagues } from '../ticker';
import type { LeagueSlug, Match, Team } from '../types';

const team = (id: string): Team => ({ id, name: id, shortName: id, tla: id.toUpperCase() });

function match(
  id: string,
  leagueSlug: LeagueSlug,
  status: Match['status'],
  kickoff: string,
): Match {
  const played = status !== 'scheduled';
  return {
    id,
    leagueSlug,
    matchday: 1,
    kickoff,
    status,
    homeTeam: team(`${id}h`),
    awayTeam: team(`${id}a`),
    score: played ? { home: 1, away: 0 } : { home: null, away: null },
  };
}

describe('latestResults', () => {
  const matches = [
    match('pl-early', 'premier-league', 'finished', '2026-09-21T11:30:00Z'),
    match('pl-late', 'premier-league', 'finished', '2026-09-21T16:00:00Z'),
    match('pl-next', 'premier-league', 'scheduled', '2026-09-21T19:00:00Z'),
    match('liga-live', 'la-liga', 'live', '2026-09-21T17:00:00Z'),
    match('ucl', 'champions-league', 'finished', '2026-09-20T19:00:00Z'),
    match('liga-old', 'la-liga', 'finished', '2026-09-17T19:00:00Z'),
  ];
  const ids = (list: Match[]) => list.map((m) => m.id);

  it('shows only the top five leagues unless told otherwise', () => {
    expect(ids(latestResults(matches))).not.toContain('ucl');
    expect(ids(latestResults(matches, { categories: 'all' }))).toContain('ucl');
    expect(ids(latestResults(matches, { categories: ['uefa'] }))).toEqual(['ucl']);
    expect(resultsLeagues().map((l) => l.slug)).toEqual([
      'premier-league',
      'la-liga',
      'serie-a',
      'bundesliga',
      'ligue-1',
    ]);
  });

  it('shows finished matches only: nothing live, nothing still to be played', () => {
    const shown = ids(latestResults(matches, { categories: 'all' }));
    expect(shown).not.toContain('liga-live');
    expect(shown).not.toContain('pl-next');
    expect(latestResults([])).toEqual([]);
  });

  it('leads with the latest result of each competition, then the rest, newest first', () => {
    // LaLiga's last result is days old and still leads ahead of the second PL game.
    expect(ids(latestResults(matches))).toEqual(['pl-late', 'liga-old', 'pl-early']);
    expect(ids(latestResults(matches, { categories: 'all' }))).toEqual([
      'ucl',
      'pl-late',
      'liga-old',
      'pl-early',
    ]);
  });
});
