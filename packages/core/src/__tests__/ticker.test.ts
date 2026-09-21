import { describe, expect, it } from 'vitest';
import { latestResults } from '../ticker';
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
  const today = [
    match('pl-early', 'premier-league', 'finished', '2026-09-21T11:30:00Z'),
    match('pl-late', 'premier-league', 'finished', '2026-09-21T16:00:00Z'),
    match('pl-next', 'premier-league', 'scheduled', '2026-09-21T19:00:00Z'),
    match('liga-live', 'la-liga', 'live', '2026-09-21T17:00:00Z'),
  ];
  const yesterday = [
    match('ucl', 'champions-league', 'finished', '2026-09-20T19:00:00Z'),
    match('liga-old', 'la-liga', 'finished', '2026-09-20T19:00:00Z'),
  ];

  it('leads with one match per competition, in display order', () => {
    const ids = latestResults(today, yesterday).map((m) => m.id);
    expect(ids.slice(0, 3)).toEqual(['ucl', 'pl-late', 'liga-live']);
  });

  it('then lists the rest: live first, today before yesterday, latest kick-off first', () => {
    const ids = latestResults(today, yesterday).map((m) => m.id);
    expect(ids.slice(3)).toEqual(['pl-early', 'liga-old']);
  });

  it('leaves out matches that have no score yet', () => {
    expect(latestResults(today, yesterday).some((m) => m.id === 'pl-next')).toBe(false);
    expect(latestResults([], [])).toEqual([]);
  });
});
