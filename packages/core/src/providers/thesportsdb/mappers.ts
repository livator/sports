import type { LeagueSlug, Match, MatchStatus, Team } from '../../types';

/* ---------- Wire types (only the fields we read) ---------- */

export interface TsdbEvent {
  idEvent: string;
  strTimestamp?: string | null;
  dateEvent?: string | null;
  strTime?: string | null;
  strStatus?: string | null;
  strPostponed?: string | null;
  intRound?: string | null;
  strSeason?: string | null;
  intHomeScore?: string | number | null;
  intAwayScore?: string | number | null;
  idHomeTeam: string;
  idAwayTeam: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strHomeTeamBadge?: string | null;
  strAwayTeamBadge?: string | null;
  strVenue?: string | null;
}

export interface TsdbEvents {
  events?: TsdbEvent[] | null;
}

export interface TsdbTeam {
  idTeam: string;
  strTeam: string;
  strTeamShort?: string | null;
  strStadium?: string | null;
  strBadge?: string | null;
}

/** Ids from this source carry a prefix, so they can never collide with another source's ids. */
export const TSDB_PREFIX = 'tsdb-';
export const toOurId = (id: string) => `${TSDB_PREFIX}${id}`;
/** The source's own id, or null for an id that is not one of ours. Digits only: it goes into a URL. */
export function toTheirId(id: string): string | null {
  const raw = id.startsWith(TSDB_PREFIX) ? id.slice(TSDB_PREFIX.length) : '';
  return /^\d{1,12}$/.test(raw) ? raw : null;
}

/**
 * A three-letter code, because this source has none for most clubs. One word gives its first
 * three letters; several give the first letter of the first word and two of the last, which
 * keeps "Universitatea Craiova" (UCR) and "Universitatea Cluj" (UCL) apart.
 */
export function tlaOf(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(' ')
    .filter(Boolean);
  const first = words[0] ?? '';
  const last = words.at(-1) ?? '';
  const code = words.length > 1 ? first.slice(0, 1) + last.slice(0, 2) : first.slice(0, 3);
  return code.toUpperCase();
}

export function mapTeam(id: string, name: string, badge?: string | null): Team {
  return {
    id: toOurId(id),
    name,
    shortName: name,
    tla: tlaOf(name),
    ...(badge ? { crestUrl: badge } : {}),
  };
}

const LIVE = new Set(['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
const FINISHED = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO', 'MATCH FINISHED']);
const POSTPONED = new Set(['PST', 'POSTPONED', 'TBD']);
const CANCELLED = new Set(['CANC', 'ABD', 'CANCELLED', 'ABANDONED']);

export function mapStatus(event: TsdbEvent): MatchStatus {
  const status = (event.strStatus ?? '').trim().toUpperCase();
  if (status === 'HT') return 'paused';
  if (LIVE.has(status)) return 'live';
  if (FINISHED.has(status)) return 'finished';
  if (CANCELLED.has(status)) return 'cancelled';
  if (POSTPONED.has(status) || event.strPostponed === 'yes') return 'postponed';
  return 'scheduled';
}

const score = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Times from this source are UTC without saying so. */
export function kickoffOf(event: TsdbEvent): string | null {
  const stamp =
    event.strTimestamp ??
    (event.dateEvent ? `${event.dateEvent}T${event.strTime ?? '12:00:00'}` : null);
  if (!stamp) return null;
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(stamp) ? stamp : `${stamp}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function mapEvent(event: TsdbEvent, leagueSlug: LeagueSlug): Match | null {
  const kickoff = kickoffOf(event);
  if (!kickoff || !event.idHomeTeam || !event.idAwayTeam) return null;
  const status = mapStatus(event);
  const started = status === 'live' || status === 'paused' || status === 'finished';
  const home = score(event.intHomeScore);
  const away = score(event.intAwayScore);
  // While a game is on, the source gives the period ("1H", "2H") rather than a minute.
  const period = (event.strStatus ?? '').trim().toUpperCase();

  return {
    id: toOurId(event.idEvent),
    leagueSlug,
    matchday: Number.parseInt(event.intRound ?? '0', 10) || 0,
    kickoff,
    status,
    homeTeam: mapTeam(event.idHomeTeam, event.strHomeTeam, event.strHomeTeamBadge),
    awayTeam: mapTeam(event.idAwayTeam, event.strAwayTeam, event.strAwayTeamBadge),
    score: started ? { home: home ?? 0, away: away ?? 0 } : { home: null, away: null },
    ...(status === 'live' && period ? { displayClock: period } : {}),
    ...(event.strVenue ? { venue: event.strVenue } : {}),
  };
}

export function mapEvents(data: TsdbEvents | null, leagueSlug: LeagueSlug): Match[] {
  return (data?.events ?? [])
    .map((event) => mapEvent(event, leagueSlug))
    .filter((m): m is Match => m !== null);
}

/** Every club that appears in a list of matches, once each. */
export function teamsIn(matches: readonly Match[]): Team[] {
  const teams = new Map<string, Team>();
  for (const m of matches) {
    teams.set(m.homeTeam.id, m.homeTeam);
    teams.set(m.awayTeam.id, m.awayTeam);
  }
  return [...teams.values()];
}

/** "2026-2027" becomes "2026/27", the way the rest of the app writes seasons. */
export function seasonLabel(season: string): string {
  const [from, to] = season.split('-');
  return from && to ? `${from}/${to.slice(-2)}` : season;
}
