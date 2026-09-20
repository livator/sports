import type { LeagueSlug, Match, MatchStatus, Player, Team } from '../../types';
import { addDays } from '../../utils/format';
import { createRng, hashString, poisson } from './rng';
import type { SeedTeam } from './teams';

export interface SimulatedSeason {
  label: string;
  startDate: string;
  endDate: string;
  totalMatchdays: number;
  matches: Match[];
}

/** Kick-off slots (UTC) spread across a weekend, relative to the Friday of the matchday. */
const SLOTS: ReadonlyArray<{ dayOffset: number; hour: number; minute: number }> = [
  { dayOffset: 0, hour: 19, minute: 0 },
  { dayOffset: 1, hour: 11, minute: 30 },
  { dayOffset: 1, hour: 14, minute: 0 },
  { dayOffset: 1, hour: 14, minute: 0 },
  { dayOffset: 1, hour: 14, minute: 0 },
  { dayOffset: 1, hour: 16, minute: 30 },
  { dayOffset: 2, hour: 13, minute: 0 },
  { dayOffset: 2, hour: 15, minute: 30 },
  { dayOffset: 2, hour: 15, minute: 30 },
  { dayOffset: 2, hour: 19, minute: 45 },
];

/**
 * Double round-robin fixture list using the circle method.
 * Returns an array of matchdays, each a list of [home, away] pairs.
 */
export function roundRobin<T>(teams: readonly T[]): Array<Array<[T, T]>> {
  const n = teams.length;
  const list = [...teams];
  const rounds: Array<Array<[T, T]>> = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[T, T]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i] as T;
      const b = list[n - 1 - i] as T;
      // alternate home/away so no team plays home every round
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    // rotate all but the first
    const fixed = list[0] as T;
    const rest = list.slice(1);
    rest.unshift(rest.pop() as T);
    list.splice(0, n, fixed, ...rest);
  }
  const reverse = rounds.map((round) => round.map(([h, a]) => [a, h] as [T, T]));
  return [...rounds, ...reverse];
}

function simulateScore(
  rng: () => number,
  home: SeedTeam,
  away: SeedTeam,
): { home: number; away: number } {
  const homeAdvantage = 0.25;
  const diff = (home.strength - away.strength) / 100;
  const homeLambda = Math.max(0.3, 1.35 + diff * 1.6 + homeAdvantage);
  const awayLambda = Math.max(0.25, 1.15 - diff * 1.6);
  return { home: poisson(rng, homeLambda), away: poisson(rng, awayLambda) };
}

/** Friday before a matchday: season starts on the given date, one matchday per week. */
function matchdayFriday(seasonStart: Date, matchday: number): Date {
  const start = new Date(seasonStart);
  const day = start.getUTCDay(); // 0 = Sunday
  const toFriday = (5 - day + 7) % 7;
  return addDays(start, toFriday + (matchday - 1) * 7);
}

function stripStrength({ strength: _strength, ...team }: SeedTeam): Team {
  return team;
}

export function simulateSeason(
  leagueSlug: LeagueSlug,
  teams: readonly SeedTeam[],
  seasonStart: Date,
  now: Date,
): SimulatedSeason {
  const rounds = roundRobin(teams);
  const matches: Match[] = [];
  const startYear = seasonStart.getUTCFullYear();

  rounds.forEach((round, roundIndex) => {
    const matchday = roundIndex + 1;
    const friday = matchdayFriday(seasonStart, matchday);
    const roundRng = createRng(hashString(`${leagueSlug}:${matchday}`));
    // shuffle slot assignment deterministically
    const slots = [...SLOTS].sort(() => roundRng() - 0.5);

    round.forEach(([home, away], i) => {
      const slot = slots[i % slots.length] as (typeof SLOTS)[number];
      const kickoff = addDays(friday, slot.dayOffset);
      kickoff.setUTCHours(slot.hour, slot.minute, 0, 0);
      const id = `${leagueSlug}-${matchday}-${home.id}-${away.id}`;
      const rng = createRng(hashString(id));

      const elapsedMin = (now.getTime() - kickoff.getTime()) / 60_000;
      let status: MatchStatus = 'scheduled';
      let minute: number | undefined;
      let score: Match['score'] = { home: null, away: null };
      let halfTimeScore: Match['halfTimeScore'];

      if (elapsedMin >= 115) {
        status = 'finished';
        const full = simulateScore(rng, home, away);
        score = full;
        halfTimeScore = {
          home: Math.floor(full.home * rng()),
          away: Math.floor(full.away * rng()),
        };
      } else if (elapsedMin >= 0) {
        // 0-45 first half, 45-60 half-time, 60-115 second half
        const partial = simulateScore(rng, home, away);
        if (elapsedMin < 45) {
          status = 'live';
          minute = Math.max(1, Math.floor(elapsedMin));
          const progress = elapsedMin / 90;
          score = {
            home: Math.floor(partial.home * progress),
            away: Math.floor(partial.away * progress),
          };
        } else if (elapsedMin < 60) {
          status = 'paused';
          score = { home: Math.floor(partial.home / 2), away: Math.floor(partial.away / 2) };
        } else {
          status = 'live';
          minute = Math.min(90, 45 + Math.floor(elapsedMin - 60));
          const progress = Math.min(1, (elapsedMin - 15) / 90);
          score = {
            home: Math.floor(partial.home * progress),
            away: Math.floor(partial.away * progress),
          };
        }
      }

      matches.push({
        id,
        leagueSlug,
        matchday,
        kickoff: kickoff.toISOString(),
        status,
        homeTeam: stripStrength(home),
        awayTeam: stripStrength(away),
        score,
        ...(halfTimeScore ? { halfTimeScore } : {}),
        ...(minute !== undefined ? { minute } : {}),
      });
    });
  });

  const last = matches.reduce((max, m) => (m.kickoff > max ? m.kickoff : max), '');
  return {
    label: `${startYear}/${String(startYear + 1).slice(-2)}`,
    startDate: seasonStart.toISOString().slice(0, 10),
    endDate: last.slice(0, 10),
    totalMatchdays: rounds.length,
    matches,
  };
}

const FIRST_NAMES = [
  'Mateo',
  'Luca',
  'Kai',
  'Noah',
  'Rafael',
  'Elias',
  'Theo',
  'Malik',
  'Jonas',
  'Enzo',
  'Diego',
  'Yusuf',
  'Ilias',
  'Adrien',
  'Marco',
  'Tomás',
  'Leon',
  'Nico',
  'Sami',
  'Ivan',
  'Bruno',
  'Aleix',
  'Emre',
  'Joel',
  'Rúben',
  'Jamal',
  'Oscar',
  'Felix',
  'Milan',
  'Karim',
];
const LAST_NAMES = [
  'Silva',
  'Fernández',
  'Rossi',
  'Müller',
  'Dubois',
  'Costa',
  'Bianchi',
  'Schneider',
  'Moreau',
  'Okafor',
  'Haaland-Berg',
  'Nakamura',
  'Ricci',
  'Lindqvist',
  'Mensah',
  'Petrov',
  'Kovač',
  'Alvarez',
  'Ndiaye',
  'Weber',
  'Laurent',
  'Conti',
  'Ortega',
  'Yilmaz',
  'Baker',
  'Novak',
  'Almeida',
  'Traoré',
  'Hansen',
  'Marino',
];
const NATIONALITIES = [
  'Spain',
  'France',
  'Brazil',
  'Argentina',
  'Germany',
  'Italy',
  'Portugal',
  'England',
  'Netherlands',
  'Norway',
  'Nigeria',
  'Senegal',
  'Japan',
  'Croatia',
  'Belgium',
  'Morocco',
];

export interface SimulatedScorer {
  player: Player;
  team: Team;
  goals: number;
  assists: number;
  penalties: number;
  playedMatches: number;
}

/** Distributes each team's goals among three fictional forwards. */
export function simulateScorers(
  leagueSlug: LeagueSlug,
  teams: readonly SeedTeam[],
  matches: readonly Match[],
): SimulatedScorer[] {
  const goalsFor = new Map<string, number>();
  const played = new Map<string, number>();
  for (const m of matches) {
    if (m.status !== 'finished') continue;
    goalsFor.set(m.homeTeam.id, (goalsFor.get(m.homeTeam.id) ?? 0) + (m.score.home ?? 0));
    goalsFor.set(m.awayTeam.id, (goalsFor.get(m.awayTeam.id) ?? 0) + (m.score.away ?? 0));
    played.set(m.homeTeam.id, (played.get(m.homeTeam.id) ?? 0) + 1);
    played.set(m.awayTeam.id, (played.get(m.awayTeam.id) ?? 0) + 1);
  }

  const scorers: SimulatedScorer[] = [];
  for (const team of teams) {
    const rng = createRng(hashString(`${leagueSlug}:scorers:${team.id}`));
    const total = goalsFor.get(team.id) ?? 0;
    const shares = [0.42, 0.24, 0.14];
    shares.forEach((share, i) => {
      const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)] as string;
      const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)] as string;
      const nationality = NATIONALITIES[Math.floor(rng() * NATIONALITIES.length)] as string;
      const goals = Math.round(total * share * (0.85 + rng() * 0.3));
      const matchesPlayed = played.get(team.id) ?? 0;
      scorers.push({
        player: {
          id: `${team.id}-p${i + 1}`,
          name: `${first} ${last}`,
          nationality,
          position: i === 2 ? 'Midfield' : 'Offence',
        },
        team: stripStrength(team),
        goals,
        assists: Math.round(goals * (0.2 + rng() * 0.5)),
        penalties: i === 0 ? Math.min(goals, Math.round(goals * 0.2 * rng() * 2)) : 0,
        playedMatches: Math.max(0, matchesPlayed - Math.floor(rng() * 3)),
      });
    });
  }
  return scorers.sort(
    (a, b) => b.goals - a.goals || b.assists - a.assists || a.playedMatches - b.playedMatches,
  );
}
