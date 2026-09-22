import type {
  FormResult,
  LeagueSlug,
  Match,
  MatchStatus,
  Scorer,
  StandingRow,
  Team,
} from '../../types';

/* ---------- Wire types (subset of api-football.com / API-Sports v3) ---------- */

export interface AfTeam {
  id: number;
  name: string;
  logo?: string;
  /** Official 3-letter code. Only `/teams` gives it; other endpoints leave it out. */
  code?: string | null;
}

export interface AfSeason {
  year: number;
  start: string;
  end: string;
  current: boolean;
}

export interface AfLeagueEntry {
  league: { id: number; name: string; type: string };
  seasons: AfSeason[];
}

export interface AfLeaguesResponse {
  response: AfLeagueEntry[];
}

export interface AfStandingRow {
  rank: number;
  team: AfTeam;
  points: number;
  goalsDiff: number;
  group: string;
  form: string | null;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
}

export interface AfStandingsResponse {
  response: Array<{ league: { standings: AfStandingRow[][] } }>;
}

export type AfFixtureStatusShort =
  | 'TBD'
  | 'NS'
  | '1H'
  | 'HT'
  | '2H'
  | 'ET'
  | 'BT'
  | 'P'
  | 'SUSP'
  | 'INT'
  | 'FT'
  | 'AET'
  | 'PEN'
  | 'PST'
  | 'CANC'
  | 'ABD'
  | 'AWD'
  | 'WO'
  | 'LIVE';

export interface AfFixture {
  fixture: {
    id: number;
    date: string;
    venue?: { name?: string | null };
    status: { short: AfFixtureStatusShort; elapsed: number | null; extra?: number | null };
  };
  league: { id: number; round: string };
  teams: { home: AfTeam; away: AfTeam };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
  };
}

export interface AfFixturesResponse {
  response: AfFixture[];
}

export interface AfScorerEntry {
  player: { id: number; name: string; nationality?: string | null };
  statistics: Array<{
    team: AfTeam;
    games: { appearences: number | null; position?: string | null };
    goals: { total: number | null; assists: number | null };
    penalty: { scored: number | null };
  }>;
}

export interface AfScorersResponse {
  response: AfScorerEntry[];
}

/* ---------- Mappers ---------- */

export function mapTeam(team: AfTeam): Team {
  const name = team.name;
  return {
    id: String(team.id),
    name,
    shortName: name,
    tla: team.code || name.slice(0, 3).toUpperCase(),
    ...(team.logo ? { crestUrl: team.logo } : {}),
  };
}

/** Left-to-right, oldest first: matches `FormResult[]`'s "most recent last" convention. */
export function mapForm(form: string | null): FormResult[] {
  if (!form) return [];
  return [...form]
    .map((c) => c.toUpperCase())
    .filter((c): c is FormResult => c === 'W' || c === 'D' || c === 'L');
}

export function mapStandingRow(row: AfStandingRow): StandingRow {
  return {
    position: row.rank,
    team: mapTeam(row.team),
    played: row.all.played,
    won: row.all.win,
    drawn: row.all.draw,
    lost: row.all.lose,
    goalsFor: row.all.goals.for,
    goalsAgainst: row.all.goals.against,
    goalDifference: row.goalsDiff,
    points: row.points,
    form: mapForm(row.form),
  };
}

export function mapStatus(status: AfFixtureStatusShort): MatchStatus {
  switch (status) {
    case '1H':
    case '2H':
    case 'ET':
    case 'BT':
    case 'P':
    case 'LIVE':
      return 'live';
    case 'HT':
    case 'SUSP':
    case 'INT':
      return 'paused';
    case 'FT':
    case 'AET':
    case 'PEN':
    case 'AWD':
    case 'WO':
      return 'finished';
    case 'PST':
      return 'postponed';
    case 'CANC':
    case 'ABD':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}

/** "Regular Season - 6" -> 6. Cup rounds without a trailing number map to 0. */
function matchdayOf(round: string): number {
  const n = /(\d+)\s*$/.exec(round)?.[1];
  return n ? Number.parseInt(n, 10) : 0;
}

export function mapMatch(fixture: AfFixture, leagueSlug: LeagueSlug): Match {
  const { status } = fixture.fixture;
  const minute = status.elapsed ?? undefined;
  const displayClock =
    minute !== undefined ? `${minute}${status.extra ? `+${status.extra}` : ''}'` : undefined;
  const venue = fixture.fixture.venue?.name ?? undefined;
  return {
    id: String(fixture.fixture.id),
    leagueSlug,
    matchday: matchdayOf(fixture.league.round),
    kickoff: new Date(fixture.fixture.date).toISOString(),
    status: mapStatus(status.short),
    homeTeam: mapTeam(fixture.teams.home),
    awayTeam: mapTeam(fixture.teams.away),
    score: { home: fixture.goals.home, away: fixture.goals.away },
    halfTimeScore: { home: fixture.score.halftime.home, away: fixture.score.halftime.away },
    ...(minute !== undefined ? { minute } : {}),
    ...(displayClock ? { displayClock } : {}),
    ...(venue ? { venue } : {}),
  };
}

export function mapScorer(entry: AfScorerEntry, index: number): Scorer | null {
  const stats = entry.statistics[0];
  if (!stats) return null;
  return {
    rank: index + 1,
    player: {
      id: String(entry.player.id),
      name: entry.player.name,
      ...(entry.player.nationality ? { nationality: entry.player.nationality } : {}),
      ...(stats.games.position ? { position: stats.games.position } : {}),
    },
    team: mapTeam(stats.team),
    goals: stats.goals.total ?? 0,
    assists: stats.goals.assists ?? 0,
    penalties: stats.penalty.scored ?? 0,
    playedMatches: stats.games.appearences ?? 0,
  };
}
