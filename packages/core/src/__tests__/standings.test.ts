import { describe, expect, it } from 'vitest';
import { computeStandings } from '../standings';
import type { Match, Team } from '../types';

const teams: Team[] = [
  { id: 'a', name: 'Alpha', shortName: 'Alpha', tla: 'ALP' },
  { id: 'b', name: 'Beta', shortName: 'Beta', tla: 'BET' },
  { id: 'c', name: 'Gamma', shortName: 'Gamma', tla: 'GAM' },
];

function match(
  home: Team,
  away: Team,
  hg: number | null,
  ag: number | null,
  status: Match['status'] = 'finished',
  kickoff = '2026-08-15T14:00:00.000Z',
): Match {
  return {
    id: `${home.id}-${away.id}-${kickoff}`,
    leagueSlug: 'premier-league',
    matchday: 1,
    kickoff,
    status,
    homeTeam: home,
    awayTeam: away,
    score: { home: hg, away: ag },
  };
}

const [a, b, c] = teams as [Team, Team, Team];

describe('computeStandings', () => {
  it('awards 3 points for a win and 1 for a draw', () => {
    const rows = computeStandings(teams, [match(a, b, 2, 0), match(b, c, 1, 1)]);
    const byId = Object.fromEntries(rows.map((r) => [r.team.id, r]));
    expect(byId.a?.points).toBe(3);
    expect(byId.b?.points).toBe(1);
    expect(byId.c?.points).toBe(1);
  });

  it('ignores matches that are not finished', () => {
    const rows = computeStandings(teams, [
      match(a, b, 1, 0, 'live'),
      match(a, c, null, null, 'scheduled'),
    ]);
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });

  it('orders by points, then goal difference, then goals for, then name', () => {
    const rows = computeStandings(teams, [
      match(a, b, 3, 0), // a +3, b -3
      match(c, b, 2, 0), // c +2, b -5
    ]);
    expect(rows.map((r) => r.team.id)).toEqual(['a', 'c', 'b']);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3]);
  });

  it('breaks ties on equal points and goal difference by goals scored', () => {
    const rows = computeStandings(teams, [
      match(a, b, 2, 1, 'finished', '2026-08-15T14:00:00.000Z'),
      match(c, b, 1, 0, 'finished', '2026-08-16T14:00:00.000Z'),
    ]);
    // a: 3pts, +1, GF 2  | c: 3pts, +1, GF 1
    expect(rows[0]?.team.id).toBe('a');
    expect(rows[1]?.team.id).toBe('c');
  });

  it('keeps only the last five results in form, most recent last', () => {
    const fixtures = Array.from({ length: 7 }, (_, i) =>
      match(a, b, i % 2 === 0 ? 1 : 0, 0, 'finished', `2026-09-0${i + 1}T14:00:00.000Z`),
    );
    const rows = computeStandings(teams, fixtures);
    const alpha = rows.find((r) => r.team.id === 'a');
    expect(alpha?.form).toHaveLength(5);
    expect(alpha?.form).toEqual(['W', 'D', 'W', 'D', 'W']);
  });
});
