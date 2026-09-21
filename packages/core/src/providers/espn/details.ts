import type {
  FormResult,
  LeagueSlug,
  LineupPlayer,
  Match,
  MatchDetail,
  MatchEvent,
  MatchLineups,
  MatchStat,
  PastMeeting,
  PlayerDetail,
  PlayerMatchLog,
  SquadPlayer,
  TeamLineup,
  TimelineEvent,
  TimelineKind,
} from '../../types';
import {
  mapStatus,
  mapTeam,
  parseScore,
  type EspnCompetitor,
  type EspnStatus,
  type EspnTeam,
} from './mappers';

/* ---------- Wire types ---------- */

interface EspnAthleteRef {
  athlete?: { id?: string; displayName?: string; shortName?: string };
}

export interface EspnKeyEvent {
  type?: { text?: string };
  clock?: { displayValue?: string };
  team?: { id?: string };
  scoringPlay?: boolean;
  text?: string;
  participants?: EspnAthleteRef[];
}

export interface EspnSummary {
  header?: {
    competitions?: Array<{
      id?: string;
      date: string;
      status: EspnStatus;
      competitors: EspnCompetitor[];
    }>;
  };
  gameInfo?: { venue?: { fullName?: string }; attendance?: number };
  boxscore?: {
    teams?: Array<{
      team?: { id?: string };
      statistics?: Array<{ name: string; displayValue?: string }>;
    }>;
  };
  keyEvents?: EspnKeyEvent[];
  seasonseries?: Array<{
    summary?: string;
    events?: Array<{ id: string; date: string; competitors?: EspnCompetitor[] }>;
  }>;
  rosters?: EspnMatchRoster[];
  lastFiveGames?: Array<{
    team?: { id?: string };
    events?: Array<{ gameDate?: string; gameResult?: string }>;
  }>;
}

export interface EspnMatchRoster {
  homeAway?: 'home' | 'away';
  formation?: string;
  roster?: Array<{
    starter?: boolean;
    jersey?: string;
    subbedIn?: boolean;
    subbedOut?: boolean;
    position?: { abbreviation?: string };
    athlete?: { id?: string; displayName?: string; shortName?: string; lastName?: string };
  }>;
}

export interface EspnRosterAthlete {
  id: string;
  displayName: string;
  jersey?: string;
  age?: number;
  citizenship?: string;
  position?: { displayName?: string };
  statistics?: {
    splits?: { categories?: Array<{ stats: Array<{ name: string; value?: number }> }> };
  };
}

export interface EspnAthleteProfile {
  athlete?: {
    id: string;
    displayName: string;
    jersey?: string;
    age?: number;
    citizenship?: string;
    displayHeight?: string;
    displayDOB?: string;
    position?: { displayName?: string };
    headshot?: { href?: string };
    team?: EspnTeam;
    statsSummary?: { statistics?: Array<{ name: string; value?: number; displayValue?: string }> };
  };
}

export interface EspnGameLog {
  names?: string[];
  events?: Record<
    string,
    { gameDate?: string; opponent?: { displayName?: string; abbreviation?: string } }
  >;
  seasonTypes?: Array<{
    categories?: Array<{ events?: Array<{ eventId: string; stats: string[] }> }>;
  }>;
}

/* ---------- Match ---------- */

/** Stats worth showing, in display order. Percent stats arrive as 0-100 or 0-1 depending on the field. */
const STAT_LABELS: ReadonlyArray<[key: string, label: string, unit?: '%']> = [
  ['possessionPct', 'Possession', '%'],
  ['totalShots', 'Shots'],
  ['shotsOnTarget', 'On target'],
  ['wonCorners', 'Corners'],
  ['foulsCommitted', 'Fouls'],
  ['offsides', 'Offsides'],
  ['totalPasses', 'Passes'],
  ['saves', 'Saves'],
];

function readStats(team: NonNullable<NonNullable<EspnSummary['boxscore']>['teams']>[number]) {
  const out = new Map<string, number>();
  for (const s of team.statistics ?? []) {
    const n = Number.parseFloat(s.displayValue ?? '');
    if (!Number.isNaN(n)) out.set(s.name, n);
  }
  return out;
}

export function mapMatchStats(summary: EspnSummary, homeId: string, awayId: string): MatchStat[] {
  const teams = summary.boxscore?.teams ?? [];
  const home = teams.find((t) => t.team?.id === homeId);
  const away = teams.find((t) => t.team?.id === awayId);
  if (!home || !away) return [];
  const h = readStats(home);
  const a = readStats(away);
  const stats: MatchStat[] = [];
  for (const [key, label, unit] of STAT_LABELS) {
    const hv = h.get(key);
    const av = a.get(key);
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

function timelineKind(event: EspnKeyEvent): TimelineKind | null {
  const text = event.type?.text ?? '';
  if (/own goal/i.test(text)) return 'own-goal';
  if (/penalty/i.test(text) && event.scoringPlay) return 'penalty-goal';
  if (event.scoringPlay || /^goal/i.test(text)) return 'goal';
  if (/red card/i.test(text)) return 'red-card';
  if (/yellow card/i.test(text)) return 'yellow-card';
  if (/substitution/i.test(text)) return 'substitution';
  return null;
}

export function mapTimeline(events: EspnKeyEvent[] | undefined, homeId: string): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];
  for (const event of events ?? []) {
    const kind = timelineKind(event);
    const teamId = event.team?.id;
    if (!kind || !teamId) continue;
    const [first, second] = event.participants ?? [];
    const detail = kind === 'substitution' ? second?.athlete?.displayName : undefined;
    timeline.push({
      minute: event.clock?.displayValue ?? '',
      side: teamId === homeId ? 'home' : 'away',
      kind,
      player: first?.athlete?.displayName ?? '',
      ...(detail ? { detail } : {}),
    });
  }
  return timeline;
}

function mapMeetings(summary: EspnSummary): PastMeeting[] {
  const meetings: PastMeeting[] = [];
  for (const event of summary.seasonseries?.[0]?.events ?? []) {
    const home = event.competitors?.find((c) => c.homeAway === 'home');
    const away = event.competitors?.find((c) => c.homeAway === 'away');
    if (!home || !away) continue;
    meetings.push({
      id: event.id,
      date: new Date(event.date).toISOString(),
      homeTeam: mapTeam(home.team),
      awayTeam: mapTeam(away.team),
      score: { home: parseScore(home.score), away: parseScore(away.score) },
    });
  }
  return meetings.sort((a, b) => b.date.localeCompare(a.date));
}

/* ---------- Line-ups and form ---------- */

/** How far up the pitch a position sits: 0 goalkeeper … 5 centre-forward. */
function lineOf(abbreviation: string): number {
  const p = abbreviation.toUpperCase().split('-')[0] ?? '';
  if (p === 'G' || p === 'GK') return 0;
  if (p === 'SW' || p.endsWith('B') || p === 'CD' || p === 'D') return 1;
  if (p === 'DM' || p === 'CDM') return 2;
  if (p === 'AM' || p === 'CAM') return 4;
  if (p.endsWith('M')) return 3;
  return 5;
}

/** Where across the pitch: negative is the team's left, positive its right. */
function sideOf(abbreviation: string): number {
  const [p = '', flank] = abbreviation.toUpperCase().split('-');
  if (flank === 'L') return -1;
  if (flank === 'R') return 1;
  if (p.length > 1 && p.startsWith('L')) return -2;
  if (p.length > 1 && p.startsWith('R')) return 2;
  return 0;
}

export function mapTeamLineup(roster: EspnMatchRoster | undefined): TeamLineup | null {
  const starters: Array<LineupPlayer & { line: number; side: number }> = [];
  const bench: LineupPlayer[] = [];
  for (const entry of roster?.roster ?? []) {
    const a = entry.athlete;
    if (!a?.id || !a.displayName) continue;
    const player: LineupPlayer = {
      id: a.id,
      name: a.displayName,
      shortName: a.lastName || a.shortName || a.displayName,
      ...(entry.jersey ? { number: entry.jersey } : {}),
      subbedIn: entry.subbedIn === true,
      subbedOut: entry.subbedOut === true,
    };
    if (!entry.starter) {
      bench.push(player);
      continue;
    }
    const position = entry.position?.abbreviation ?? '';
    starters.push({ ...player, line: lineOf(position), side: sideOf(position) });
  }
  if (starters.length === 0) return null;

  starters.sort((a, b) => a.line - b.line);
  // "4-2-3-1" says how many players each line holds; the goalkeeper is implied.
  const formation = roster?.formation;
  const shape = (formation ?? '').split('-').map((n) => Number.parseInt(n, 10));
  const fits =
    shape.length > 1 &&
    shape.every((n) => n > 0) &&
    shape.reduce((sum, n) => sum + n, 1) === starters.length;

  const rows: Array<typeof starters> = [];
  if (fits) {
    let at = 0;
    for (const size of [1, ...shape]) {
      rows.push(starters.slice(at, at + size));
      at += size;
    }
  } else {
    for (const s of starters) {
      const last = rows.at(-1);
      if (last && last[0]?.line === s.line) last.push(s);
      else rows.push([s]);
    }
  }

  const strip = ({ line: _line, side: _side, ...player }: (typeof starters)[number]) => player;
  return {
    ...(formation ? { formation } : {}),
    rows: rows.map((row) => [...row].sort((a, b) => a.side - b.side).map(strip)),
    bench,
  };
}

function mapLineups(summary: EspnSummary): MatchLineups | null {
  const home = mapTeamLineup(summary.rosters?.find((r) => r.homeAway === 'home'));
  const away = mapTeamLineup(summary.rosters?.find((r) => r.homeAway === 'away'));
  return home && away ? { home, away } : null;
}

function mapRecentForm(summary: EspnSummary, teamId: string): FormResult[] {
  const games = summary.lastFiveGames?.find((g) => g.team?.id === teamId)?.events ?? [];
  return [...games]
    .sort((a, b) => (a.gameDate ?? '').localeCompare(b.gameDate ?? ''))
    .map((g) => g.gameResult)
    .filter((r): r is FormResult => r === 'W' || r === 'D' || r === 'L')
    .slice(-5);
}

export function mapMatchDetail(
  summary: EspnSummary,
  leagueSlug: LeagueSlug,
  matchId: string,
): MatchDetail | null {
  const competition = summary.header?.competitions?.[0];
  const home = competition?.competitors.find((c) => c.homeAway === 'home');
  const away = competition?.competitors.find((c) => c.homeAway === 'away');
  if (!competition || !home || !away) return null;

  const status = mapStatus(competition.status);
  const started = status === 'live' || status === 'paused' || status === 'finished';
  const timeline = mapTimeline(summary.keyEvents, home.team.id);
  const events: MatchEvent[] = timeline
    .filter((e) => e.kind !== 'yellow-card' && e.kind !== 'substitution')
    .map((e) => ({
      type: e.kind as MatchEvent['type'],
      minute: e.minute,
      teamId: e.side === 'home' ? home.team.id : away.team.id,
      player: e.player,
    }));
  const venue = summary.gameInfo?.venue?.fullName;
  const clock = competition.status.displayClock;
  const attendance = summary.gameInfo?.attendance;

  const match: Match = {
    id: matchId,
    leagueSlug,
    matchday: 0,
    kickoff: new Date(competition.date).toISOString(),
    status,
    homeTeam: mapTeam(home.team),
    awayTeam: mapTeam(away.team),
    score: started
      ? { home: parseScore(home.score) ?? 0, away: parseScore(away.score) ?? 0 }
      : { home: null, away: null },
    ...(status === 'live' && clock ? { displayClock: clock } : {}),
    ...(events.length > 0 ? { events } : {}),
    ...(venue ? { venue } : {}),
  };

  const summaryLine = summary.seasonseries?.[0]?.summary;
  const lineups = mapLineups(summary);
  const form = {
    home: mapRecentForm(summary, home.team.id),
    away: mapRecentForm(summary, away.team.id),
  };
  return {
    match,
    ...(attendance ? { attendance } : {}),
    ...(lineups ? { lineups } : {}),
    ...(form.home.length > 0 || form.away.length > 0 ? { form } : {}),
    stats: started ? mapMatchStats(summary, home.team.id, away.team.id) : [],
    timeline,
    headToHead: {
      ...(summaryLine ? { summary: summaryLine } : {}),
      meetings: mapMeetings(summary),
    },
  };
}

/* ---------- Squad and player ---------- */

export function mapSquadPlayer(athlete: EspnRosterAthlete): SquadPlayer {
  const stats = new Map<string, number>();
  for (const category of athlete.statistics?.splits?.categories ?? []) {
    for (const s of category.stats) if (s.value !== undefined) stats.set(s.name, s.value);
  }
  const position = athlete.position?.displayName;
  return {
    id: athlete.id,
    name: athlete.displayName,
    ...(athlete.jersey ? { number: athlete.jersey } : {}),
    ...(position ? { position } : {}),
    ...(athlete.age !== undefined ? { age: athlete.age } : {}),
    ...(athlete.citizenship ? { nationality: athlete.citizenship } : {}),
    appearances: stats.get('appearances') ?? 0,
    goals: stats.get('totalGoals') ?? 0,
    assists: stats.get('goalAssists') ?? 0,
  };
}

const POSITION_ORDER = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];

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

export function mapGameLog(log: EspnGameLog): PlayerMatchLog[] {
  const goalsAt = log.names?.indexOf('totalGoals') ?? -1;
  const assistsAt = log.names?.indexOf('goalAssists') ?? -1;
  const rows: PlayerMatchLog[] = [];
  for (const category of log.seasonTypes?.[0]?.categories ?? []) {
    for (const entry of category.events ?? []) {
      const meta = log.events?.[entry.eventId];
      const opponent = meta?.opponent?.displayName;
      rows.push({
        matchId: entry.eventId,
        ...(meta?.gameDate ? { date: new Date(meta.gameDate).toISOString() } : {}),
        ...(opponent ? { opponent } : {}),
        goals: Number.parseInt(entry.stats[goalsAt] ?? '0', 10) || 0,
        assists: Number.parseInt(entry.stats[assistsAt] ?? '0', 10) || 0,
      });
    }
  }
  return rows.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
}

export function mapPlayerDetail(
  profile: EspnAthleteProfile,
  log: EspnGameLog | null,
  leagueSlug: LeagueSlug,
): PlayerDetail | null {
  const a = profile.athlete;
  if (!a) return null;
  const summary = new Map<string, number>();
  for (const s of a.statsSummary?.statistics ?? []) {
    const n = s.value ?? Number.parseFloat(s.displayValue ?? '');
    if (!Number.isNaN(n)) summary.set(s.name, n);
  }
  const matchLog = log ? mapGameLog(log) : [];
  const position = a.position?.displayName;
  const shots = summary.get('totalShots');
  return {
    player: {
      id: a.id,
      name: a.displayName,
      ...(a.jersey ? { number: a.jersey } : {}),
      ...(position ? { position } : {}),
      ...(a.age !== undefined ? { age: a.age } : {}),
      ...(a.citizenship ? { nationality: a.citizenship } : {}),
      ...(a.headshot?.href ? { headshotUrl: a.headshot.href } : {}),
      ...(a.displayHeight ? { height: a.displayHeight } : {}),
      ...(a.displayDOB ? { dateOfBirth: a.displayDOB } : {}),
      ...(shots !== undefined ? { shots } : {}),
      appearances: summary.get('starts-subIns') ?? matchLog.length,
      goals: summary.get('totalGoals') ?? matchLog.reduce((n, m) => n + m.goals, 0),
      assists: summary.get('goalAssists') ?? matchLog.reduce((n, m) => n + m.assists, 0),
    },
    ...(a.team ? { team: mapTeam(a.team) } : {}),
    leagueSlug,
    log: matchLog,
  };
}
