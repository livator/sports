import type { FormResult, Match, StandingRow, Team } from './types';

/** Points awarded per result. */
export const POINTS = { win: 3, draw: 1, loss: 0 } as const;

interface Accumulator extends Omit<StandingRow, 'position' | 'form'> {
  results: FormResult[];
}

/**
 * Builds a league table purely from finished matches.
 * Tie-breakers: points, goal difference, goals for, then alphabetical name.
 * The `form` field contains the last five results, most recent last.
 */
export function computeStandings(teams: readonly Team[], matches: readonly Match[]): StandingRow[] {
  const acc = new Map<string, Accumulator>();
  for (const team of teams) {
    acc.set(team.id, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      results: [],
    });
  }

  const finished = matches
    .filter((m) => m.status === 'finished' && m.score.home !== null && m.score.away !== null)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  for (const match of finished) {
    const home = acc.get(match.homeTeam.id);
    const away = acc.get(match.awayTeam.id);
    if (!home || !away) continue;
    const hg = match.score.home as number;
    const ag = match.score.away as number;

    home.played++;
    away.played++;
    home.goalsFor += hg;
    home.goalsAgainst += ag;
    away.goalsFor += ag;
    away.goalsAgainst += hg;

    if (hg > ag) {
      home.won++;
      away.lost++;
      home.points += POINTS.win;
      home.results.push('W');
      away.results.push('L');
    } else if (hg < ag) {
      away.won++;
      home.lost++;
      away.points += POINTS.win;
      home.results.push('L');
      away.results.push('W');
    } else {
      home.drawn++;
      away.drawn++;
      home.points += POINTS.draw;
      away.points += POINTS.draw;
      home.results.push('D');
      away.results.push('D');
    }
  }

  const rows = [...acc.values()].map<Omit<StandingRow, 'position'>>(({ results, ...row }) => ({
    ...row,
    goalDifference: row.goalsFor - row.goalsAgainst,
    form: results.slice(-5),
  }));

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.team.name.localeCompare(b.team.name),
  );

  return rows.map((row, i) => ({ position: i + 1, ...row }));
}
