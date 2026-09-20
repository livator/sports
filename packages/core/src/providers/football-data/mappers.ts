import type {
  FormResult,
  LeagueSlug,
  Match,
  MatchStatus,
  Scorer,
  StandingRow,
  Team,
} from '../../types';

/* ---------- Wire types (subset of football-data.org v4) ---------- */

export interface FdTeam {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
}

export interface FdCompetition {
  code: string;
  name: string;
  currentSeason: {
    startDate: string;
    endDate: string;
    currentMatchday: number | null;
  };
}

export interface FdStandingsResponse {
  season: { startDate: string; endDate: string; currentMatchday: number | null };
  standings: Array<{
    type: 'TOTAL' | 'HOME' | 'AWAY';
    table: FdTableRow[];
  }>;
}

export interface FdTableRow {
  position: number;
  team: FdTeam;
  playedGames: number;
  form: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export type FdMatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'SUSPENDED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'AWARDED';

export interface FdMatch {
  id: number;
  utcDate: string;
  status: FdMatchStatus;
  matchday: number | null;
  minute?: number | null;
  competition?: { code: string };
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
}

export interface FdMatchesResponse {
  matches: FdMatch[];
}

export interface FdScorersResponse {
  scorers: Array<{
    player: { id: number; name: string; nationality?: string | null; section?: string | null };
    team: FdTeam;
    playedMatches: number;
    goals: number;
    assists: number | null;
    penalties: number | null;
  }>;
}

/* ---------- Mappers ---------- */

export function mapTeam(team: FdTeam): Team {
  const name = team.name;
  return {
    id: String(team.id),
    name,
    shortName: team.shortName ?? name,
    tla: team.tla ?? name.slice(0, 3).toUpperCase(),
    ...(team.crest ? { crestUrl: team.crest } : {}),
  };
}

export function mapForm(form: string | null): FormResult[] {
  if (!form) return [];
  return form
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is FormResult => s === 'W' || s === 'D' || s === 'L');
}

export function mapStandingRow(row: FdTableRow): StandingRow {
  return {
    position: row.position,
    team: mapTeam(row.team),
    played: row.playedGames,
    won: row.won,
    drawn: row.draw,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
    points: row.points,
    form: mapForm(row.form),
  };
}

export function mapStatus(status: FdMatchStatus): MatchStatus {
  switch (status) {
    case 'IN_PLAY':
      return 'live';
    case 'PAUSED':
      return 'paused';
    case 'FINISHED':
    case 'AWARDED':
      return 'finished';
    case 'POSTPONED':
    case 'SUSPENDED':
      return 'postponed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}

export function mapMatch(match: FdMatch, leagueSlug: LeagueSlug): Match {
  const minute = match.minute ?? undefined;
  return {
    id: String(match.id),
    leagueSlug,
    matchday: match.matchday ?? 0,
    kickoff: match.utcDate,
    status: mapStatus(match.status),
    homeTeam: mapTeam(match.homeTeam),
    awayTeam: mapTeam(match.awayTeam),
    score: { home: match.score.fullTime.home, away: match.score.fullTime.away },
    halfTimeScore: { home: match.score.halfTime.home, away: match.score.halfTime.away },
    ...(minute !== undefined ? { minute } : {}),
  };
}

export function mapScorer(scorer: FdScorersResponse['scorers'][number], index: number): Scorer {
  return {
    rank: index + 1,
    player: {
      id: String(scorer.player.id),
      name: scorer.player.name,
      ...(scorer.player.nationality ? { nationality: scorer.player.nationality } : {}),
      ...(scorer.player.section ? { position: scorer.player.section } : {}),
    },
    team: mapTeam(scorer.team),
    goals: scorer.goals,
    assists: scorer.assists ?? 0,
    penalties: scorer.penalties ?? 0,
    playedMatches: scorer.playedMatches,
  };
}
