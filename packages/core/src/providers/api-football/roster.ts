import type { LeagueSlug, PlayerDetail, PlayerMatchLog, SquadPlayer } from '../../types';
import { mapTeam, type AfTeam } from './mappers';

/* ---------- Wire types ---------- */

export interface AfTeamInfo {
  team: AfTeam;
  venue?: { name?: string | null } | null;
}

export interface AfTeamInfoResponse {
  response: AfTeamInfo[];
}

export interface AfPlayerProfile {
  id: number;
  name: string;
  age?: number | null;
  birth?: { date?: string | null } | null;
  nationality?: string | null;
  height?: string | null;
  photo?: string | null;
  injured?: boolean;
}

export interface AfPlayerStats {
  team: AfTeam;
  league: { id: number };
  games: { appearences: number | null; number: number | null; position?: string | null };
  goals: { total: number | null; assists: number | null };
  shots: { total: number | null };
}

export interface AfPlayerStatEntry {
  player: AfPlayerProfile;
  statistics: AfPlayerStats[];
}

export interface AfPlayersResponse {
  paging: { current: number; total: number };
  response: AfPlayerStatEntry[];
}

/* ---------- Squad ---------- */

/** api-football's broad position labels, goalkeeper to attacker. */
const POSITION_ORDER = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'];

export function sortSquad(squad: SquadPlayer[]): SquadPlayer[] {
  const rank = (p: SquadPlayer) => {
    const i = POSITION_ORDER.indexOf(p.position ?? '');
    return i === -1 ? POSITION_ORDER.length : i;
  };
  return [...squad].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      Number.parseInt(a.number ?? '999', 10) - Number.parseInt(b.number ?? '999', 10),
  );
}

/**
 * `/players` reports one `statistics` entry per competition a player appeared in this season
 * (league, cups, internationals); this picks the one for the league the page is about, so a
 * cup-only appearance does not inflate a league squad list.
 */
export function mapSquadPlayer(entry: AfPlayerStatEntry, leagueId: number): SquadPlayer {
  const stats = entry.statistics.find((s) => s.league.id === leagueId);
  return {
    id: String(entry.player.id),
    name: entry.player.name,
    ...(stats?.games.number != null ? { number: String(stats.games.number) } : {}),
    ...(stats?.games.position ? { position: stats.games.position } : {}),
    ...(entry.player.age != null ? { age: entry.player.age } : {}),
    ...(entry.player.nationality ? { nationality: entry.player.nationality } : {}),
    appearances: stats?.games.appearences ?? 0,
    goals: stats?.goals.total ?? 0,
    assists: stats?.goals.assists ?? 0,
    ...(entry.player.injured !== undefined ? { injured: entry.player.injured } : {}),
  };
}

/* ---------- Player detail ---------- */

/**
 * The source has no per-match log for a player (it would cost one request per fixture to
 * build), so `log` is always empty here; the season totals above still come through.
 */
export function mapPlayerDetail(
  entry: AfPlayerStatEntry,
  leagueId: number,
  leagueSlug: LeagueSlug,
): PlayerDetail {
  const stats = entry.statistics.find((s) => s.league.id === leagueId);
  const squad = mapSquadPlayer(entry, leagueId);
  const shots = stats?.shots.total ?? undefined;
  const log: PlayerMatchLog[] = [];
  return {
    player: {
      ...squad,
      ...(entry.player.photo ? { headshotUrl: entry.player.photo } : {}),
      ...(entry.player.height ? { height: `${entry.player.height} cm` } : {}),
      ...(entry.player.birth?.date ? { dateOfBirth: entry.player.birth.date } : {}),
      ...(shots !== undefined ? { shots } : {}),
    },
    ...(stats ? { team: mapTeam(stats.team) } : {}),
    leagueSlug,
    log,
  };
}
