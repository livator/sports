import type {
  FormResult,
  LeagueSlug,
  LineupPlayer,
  MatchDetail,
  MatchEvent,
  MatchLineups,
  MatchPrediction,
  MatchStat,
  PastMeeting,
  TeamLineup,
  TimelineEvent,
  TimelineKind,
} from '../../types';
import { mapMatch, mapTeam, type AfFixture, type AfTeam } from './mappers';

/* ---------- Wire types (fixture detail, head-to-head) ---------- */

export interface AfEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number };
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: 'Goal' | 'Card' | 'subst' | 'Var';
  detail: string;
}

export interface AfLineupPlayerEntry {
  player: {
    id: number;
    name: string;
    number: number | null;
    grid: string | null;
  };
}

export interface AfLineup {
  team: { id: number };
  formation?: string | null;
  startXI: AfLineupPlayerEntry[];
  substitutes: AfLineupPlayerEntry[];
}

export interface AfStatValue {
  type: string;
  value: number | string | null;
}

export interface AfTeamStatistics {
  team: { id: number };
  statistics: AfStatValue[];
}

export interface AfFixtureFull extends AfFixture {
  events?: AfEvent[];
  lineups?: AfLineup[];
  statistics?: AfTeamStatistics[];
}

export interface AfFixtureFullResponse {
  response: AfFixtureFull[];
}

export interface AfH2HFixture {
  fixture: { id: number; date: string };
  teams: { home: AfTeam; away: AfTeam };
  goals: { home: number | null; away: number | null };
}

export interface AfH2HResponse {
  response: AfH2HFixture[];
}

export interface AfPredictionEntry {
  predictions: {
    winner: { id: number | null; name: string | null } | null;
    percent: { home: string; draw: string; away: string };
  };
}

export interface AfPredictionResponse {
  response: AfPredictionEntry[];
}

/* ---------- Timeline and match events ---------- */

function timelineKind(event: AfEvent): TimelineKind | null {
  if (event.type === 'Goal') {
    if (/missed/i.test(event.detail)) return null;
    if (/own/i.test(event.detail)) return 'own-goal';
    if (/penalty/i.test(event.detail)) return 'penalty-goal';
    return 'goal';
  }
  if (event.type === 'Card') {
    if (/red/i.test(event.detail)) return 'red-card';
    if (/yellow/i.test(event.detail)) return 'yellow-card';
    return null;
  }
  if (event.type === 'subst') return 'substitution';
  return null;
}

/**
 * A `subst` event's `player` is the one going off and `assist` the one coming on — the
 * opposite of `TimelineEvent`'s own convention, where `player` is the main actor shown first.
 */
export function mapTimeline(events: AfEvent[] | undefined, homeId: number): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];
  for (const event of events ?? []) {
    const kind = timelineKind(event);
    if (!kind) continue;
    const minute = `${event.time.elapsed}${event.time.extra ? `+${event.time.extra}` : ''}'`;
    const side = event.team.id === homeId ? 'home' : 'away';
    if (kind === 'substitution') {
      const detail = event.player.name ?? undefined;
      timeline.push({
        minute,
        side,
        kind,
        player: event.assist.name ?? '',
        ...(detail ? { detail } : {}),
      });
    } else {
      timeline.push({ minute, side, kind, player: event.player.name ?? '' });
    }
  }
  return timeline;
}

/* ---------- Statistics ---------- */

/** api-football's stat name -> our stat key/label. Keys match the ones ESPN uses, so
 * translations (`statLabels.*`) apply the same way regardless of provider. */
const STAT_LABELS: ReadonlyArray<[apiType: string, key: string, label: string, unit?: '%']> = [
  ['Ball Possession', 'possessionPct', 'Possession', '%'],
  ['Total Shots', 'totalShots', 'Shots'],
  ['Shots on Goal', 'shotsOnTarget', 'On target'],
  ['Corner Kicks', 'wonCorners', 'Corners'],
  ['Fouls', 'foulsCommitted', 'Fouls'],
  ['Offsides', 'offsides', 'Offsides'],
  ['Total passes', 'totalPasses', 'Passes'],
  ['Goalkeeper Saves', 'saves', 'Saves'],
];

function statValue(value: number | string | null): number | undefined {
  if (value === null) return undefined;
  if (typeof value === 'number') return value;
  const n = Number.parseFloat(value.replace('%', ''));
  return Number.isNaN(n) ? undefined : n;
}

export function mapMatchStats(
  statistics: AfTeamStatistics[] | undefined,
  homeId: number,
  awayId: number,
): MatchStat[] {
  const home = statistics?.find((s) => s.team.id === homeId);
  const away = statistics?.find((s) => s.team.id === awayId);
  if (!home || !away) return [];
  const homeValues = new Map(home.statistics.map((s) => [s.type, statValue(s.value)]));
  const awayValues = new Map(away.statistics.map((s) => [s.type, statValue(s.value)]));
  const stats: MatchStat[] = [];
  for (const [apiType, key, label, unit] of STAT_LABELS) {
    const hv = homeValues.get(apiType);
    const av = awayValues.get(apiType);
    if (hv === undefined || av === undefined) continue;
    stats.push({
      key,
      label,
      home: Math.round(hv),
      away: Math.round(av),
      ...(unit ? { unit } : {}),
    });
  }
  return stats;
}

/* ---------- Line-ups ---------- */

function subIds(events: AfEvent[] | undefined): { onIds: Set<number>; offIds: Set<number> } {
  const onIds = new Set<number>();
  const offIds = new Set<number>();
  for (const event of events ?? []) {
    if (event.type !== 'subst') continue;
    if (event.assist.id !== null) onIds.add(event.assist.id);
    if (event.player.id !== null) offIds.add(event.player.id);
  }
  return { onIds, offIds };
}

function mapTeamLineup(
  lineup: AfLineup | undefined,
  subs: { onIds: Set<number>; offIds: Set<number> },
): TeamLineup | null {
  if (!lineup) return null;
  const toPlayer = (entry: AfLineupPlayerEntry): LineupPlayer => ({
    id: String(entry.player.id),
    name: entry.player.name,
    shortName: entry.player.name,
    ...(entry.player.number !== null ? { number: String(entry.player.number) } : {}),
    subbedIn: subs.onIds.has(entry.player.id),
    subbedOut: subs.offIds.has(entry.player.id),
  });

  // `grid` is "row:col": row 1 is the goalkeeper, higher rows are further upfield. Column
  // order within a row is already the pitch's left-to-right order, so no heuristics needed.
  const byRow = new Map<number, Array<{ col: number; player: LineupPlayer }>>();
  for (const entry of lineup.startXI) {
    const [rowStr, colStr] = entry.player.grid?.split(':') ?? [];
    const row = Number.parseInt(rowStr ?? '', 10);
    const col = Number.parseInt(colStr ?? '', 10);
    if (Number.isNaN(row) || Number.isNaN(col)) continue;
    const list = byRow.get(row) ?? [];
    list.push({ col, player: toPlayer(entry) });
    byRow.set(row, list);
  }
  const rows = [...byRow.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, entries]) => entries.sort((a, b) => a.col - b.col).map((e) => e.player));

  return {
    ...(lineup.formation ? { formation: lineup.formation } : {}),
    rows,
    bench: lineup.substitutes.map(toPlayer),
  };
}

export function mapLineups(fixture: AfFixtureFull): MatchLineups | null {
  const subs = subIds(fixture.events);
  const home = mapTeamLineup(
    fixture.lineups?.find((l) => l.team.id === fixture.teams.home.id),
    subs,
  );
  const away = mapTeamLineup(
    fixture.lineups?.find((l) => l.team.id === fixture.teams.away.id),
    subs,
  );
  return home && away ? { home, away } : null;
}

/* ---------- Head-to-head ---------- */

export function mapMeeting(entry: AfH2HFixture): PastMeeting {
  return {
    id: String(entry.fixture.id),
    date: new Date(entry.fixture.date).toISOString(),
    homeTeam: mapTeam(entry.teams.home),
    awayTeam: mapTeam(entry.teams.away),
    score: { home: entry.goals.home, away: entry.goals.away },
  };
}

/* ---------- Predictions ---------- */

export function mapPrediction(entry: AfPredictionEntry | undefined): MatchPrediction | null {
  if (!entry) return null;
  const pct = (s: string) => Number.parseInt(s, 10);
  const { winner, percent } = entry.predictions;
  const home = pct(percent.home);
  const draw = pct(percent.draw);
  const away = pct(percent.away);
  if (Number.isNaN(home) || Number.isNaN(draw) || Number.isNaN(away)) return null;
  return {
    percent: { home, draw, away },
    ...(winner?.id != null ? { winnerTeamId: String(winner.id) } : {}),
  };
}

/* ---------- Assembly ---------- */

export function mapMatchDetail(
  fixture: AfFixtureFull,
  leagueSlug: LeagueSlug,
  meetings: PastMeeting[],
  form: { home: FormResult[]; away: FormResult[] },
  prediction: MatchPrediction | null,
): MatchDetail {
  const match = mapMatch(fixture, leagueSlug);
  const timeline = mapTimeline(fixture.events, fixture.teams.home.id);
  const events: MatchEvent[] = timeline
    .filter((e) => e.kind !== 'yellow-card' && e.kind !== 'substitution')
    .map((e) => ({
      type: e.kind as MatchEvent['type'],
      minute: e.minute,
      teamId: e.side === 'home' ? match.homeTeam.id : match.awayTeam.id,
      player: e.player,
    }));
  const lineups = mapLineups(fixture);

  return {
    match: { ...match, ...(events.length > 0 ? { events } : {}) },
    stats: mapMatchStats(fixture.statistics, fixture.teams.home.id, fixture.teams.away.id),
    timeline,
    ...(lineups ? { lineups } : {}),
    ...(form.home.length > 0 || form.away.length > 0 ? { form } : {}),
    headToHead: { meetings },
    ...(prediction ? { prediction } : {}),
  };
}
