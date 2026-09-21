import type {
  LeagueSlug,
  Match,
  MatchEvent,
  MatchStatus,
  Scorer,
  StandingRow,
  StandingsGroup,
  Team,
  ZoneKind,
} from '../../types';

/* ---------- Wire types (subset of ESPN's public site API) ---------- */

export interface EspnTeam {
  id: string;
  displayName: string;
  shortDisplayName?: string;
  name?: string;
  abbreviation?: string;
  logo?: string;
  logos?: Array<{ href: string }>;
  color?: string;
  alternateColor?: string;
}

export interface EspnStatus {
  clock?: number;
  displayClock?: string;
  period?: number;
  type: {
    name: string;
    state: 'pre' | 'in' | 'post';
    completed?: boolean;
  };
}

export interface EspnDetail {
  type?: { text?: string };
  clock?: { displayValue?: string };
  team?: { id: string };
  scoringPlay?: boolean;
  redCard?: boolean;
  penaltyKick?: boolean;
  ownGoal?: boolean;
  shootout?: boolean;
  athletesInvolved?: Array<{ displayName?: string; shortName?: string }>;
}

export interface EspnCompetitor {
  homeAway: 'home' | 'away';
  /** A plain string on scoreboards, an object on team schedules. */
  score?: string | { displayValue?: string };
  team: EspnTeam;
}

export interface EspnEvent {
  id: string;
  date: string;
  /** Scoreboards put status on the event; team schedules put it on the competition. */
  status?: EspnStatus;
  competitions: Array<{
    status?: EspnStatus;
    venue?: { fullName?: string };
    competitors: EspnCompetitor[];
    details?: EspnDetail[];
  }>;
}

export interface EspnScoreboard {
  leagues?: Array<{
    season?: { year: number; startDate: string; endDate: string };
  }>;
  events?: EspnEvent[];
}

export interface EspnStandings {
  season?: { year: number };
  children?: Array<{
    /** e.g. "Group A1". Single-table leagues have one child. */
    name?: string;
    standings?: {
      entries?: Array<{
        team: EspnTeam;
        /** What finishing here means, in English prose. */
        note?: { description?: string };
        stats: Array<{ name: string; value?: number }>;
      }>;
    };
  }>;
}

export interface EspnStatistics {
  stats?: Array<{
    name: string;
    leaders?: Array<{
      value: number;
      athlete: {
        id: string;
        displayName: string;
        team?: EspnTeam;
        statistics?: Array<{ name: string; value?: number }>;
      };
    }>;
  }>;
}

/* ---------- Mappers ---------- */

const hex = (value: string | undefined): string | undefined =>
  value && /^[0-9a-f]{6}$/i.test(value) ? `#${value.toLowerCase()}` : undefined;

export function mapTeam(team: EspnTeam): Team {
  const crestUrl = team.logo ?? team.logos?.[0]?.href;
  const primary = hex(team.color);
  const secondary = hex(team.alternateColor);
  return {
    id: team.id,
    name: team.displayName,
    shortName: team.shortDisplayName ?? team.displayName,
    tla: team.abbreviation ?? team.displayName.slice(0, 3).toUpperCase(),
    ...(crestUrl ? { crestUrl } : {}),
    ...(primary ? { colors: { primary, secondary: secondary ?? primary } } : {}),
  };
}

export function mapStatus(status: EspnStatus): MatchStatus {
  const { name, state } = status.type;
  if (name === 'STATUS_POSTPONED' || name === 'STATUS_DELAYED') return 'postponed';
  if (name === 'STATUS_CANCELED' || name === 'STATUS_ABANDONED') return 'cancelled';
  if (name === 'STATUS_HALFTIME') return 'paused';
  if (state === 'in') return 'live';
  if (state === 'post') return 'finished';
  return 'scheduled';
}

export function mapEvents(details: EspnDetail[] | undefined): MatchEvent[] {
  const events: MatchEvent[] = [];
  for (const d of details ?? []) {
    if (d.shootout || !d.team?.id) continue;
    const isGoal = d.scoringPlay === true;
    if (!isGoal && !d.redCard) continue;
    const athlete = d.athletesInvolved?.[0];
    events.push({
      type:
        d.redCard && !isGoal
          ? 'red-card'
          : d.ownGoal
            ? 'own-goal'
            : d.penaltyKick
              ? 'penalty-goal'
              : 'goal',
      minute: d.clock?.displayValue ?? '',
      teamId: d.team.id,
      player: athlete?.shortName ?? athlete?.displayName ?? '',
    });
  }
  return events;
}

export function parseScore(value: EspnCompetitor['score']): number | null {
  const raw = typeof value === 'object' ? value.displayValue : value;
  if (raw === undefined || raw === '') return null;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

export function mapEvent(event: EspnEvent, leagueSlug: LeagueSlug): Match | null {
  const competition = event.competitions[0];
  const home = competition?.competitors.find((c) => c.homeAway === 'home');
  const away = competition?.competitors.find((c) => c.homeAway === 'away');
  const rawStatus = event.status ?? competition?.status;
  if (!competition || !home || !away || !rawStatus) return null;

  const status = mapStatus(rawStatus);
  const started = status === 'live' || status === 'paused' || status === 'finished';
  const events = mapEvents(competition.details);
  const venue = competition.venue?.fullName;
  const clock = rawStatus.displayClock;

  return {
    id: event.id,
    leagueSlug,
    matchday: 0,
    kickoff: new Date(event.date).toISOString(),
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
}

function stat(stats: Array<{ name: string; value?: number }>, name: string): number {
  return stats.find((s) => s.name === name)?.value ?? 0;
}

/**
 * Turns ESPN's free-text table notes into a zone. The order matters: the most specific
 * phrases are tested first, because notes like "A, B: Relegation; C: Relegation or playoffs"
 * or "Qualifies for World Cup playoffs" contain several trigger words.
 */
export function zoneFromNote(description: string | undefined): ZoneKind | null {
  if (!description) return null;
  const d = description.toLowerCase();
  if (/relegat[a-z]* play-?offs?/.test(d)) return 'relegation-playoff';
  if (/relegat/.test(d)) return 'relegation';
  if (/eliminated/.test(d)) return 'eliminated';
  if (/champions league/.test(d)) return 'champions-league';
  if (/europa league/.test(d)) return 'europa-league';
  if (/conference league/.test(d)) return 'conference-league';
  // Split-season leagues (Belgium, Greece, Austria, Denmark): the top half plays for the title.
  if (/championship play-?offs?/.test(d)) return 'advance';
  if (/qualifies for [^;]*play-?offs?/.test(d)) return 'playoff';
  if (/qualif|advance|promotion(?! ?play)/.test(d)) return 'advance';
  if (/play-?offs?/.test(d)) return 'playoff';
  return null;
}

type EspnEntries = NonNullable<
  NonNullable<NonNullable<EspnStandings['children']>[number]['standings']>['entries']
>;

function mapEntries(entries: EspnEntries): StandingRow[] {
  return entries
    .map((entry, index) => ({
      position: stat(entry.stats, 'rank') || index + 1,
      team: mapTeam(entry.team),
      played: stat(entry.stats, 'gamesPlayed'),
      won: stat(entry.stats, 'wins'),
      drawn: stat(entry.stats, 'ties'),
      lost: stat(entry.stats, 'losses'),
      goalsFor: stat(entry.stats, 'pointsFor'),
      goalsAgainst: stat(entry.stats, 'pointsAgainst'),
      goalDifference: stat(entry.stats, 'pointDifferential'),
      points: stat(entry.stats, 'points'),
      form: [],
      zone: zoneFromNote(entry.note?.description),
    }))
    .sort((a, b) => a.position - b.position);
}

/** One group per table. Single-table leagues come back as one group. */
export function mapStandingsGroups(data: EspnStandings): StandingsGroup[] {
  return (data.children ?? [])
    .map((child, i) => ({
      name: child.name ?? `Group ${i + 1}`,
      rows: mapEntries(child.standings?.entries ?? []),
    }))
    .filter((group) => group.rows.length > 0);
}

/** Every row of every table, in group order. */
export function mapStandings(data: EspnStandings): StandingRow[] {
  return mapStandingsGroups(data).flatMap((group) => group.rows);
}

export function mapScorers(data: EspnStatistics, limit: number): Scorer[] {
  const leaders = data.stats?.find((s) => s.name === 'goalsLeaders')?.leaders ?? [];
  return leaders
    .filter((l) => l.athlete.team)
    .slice(0, limit)
    .map((l, i) => {
      const stats = l.athlete.statistics ?? [];
      return {
        rank: i + 1,
        player: { id: l.athlete.id, name: l.athlete.displayName },
        team: mapTeam(l.athlete.team as EspnTeam),
        goals: stat(stats, 'totalGoals') || l.value,
        assists: stat(stats, 'goalAssists'),
        playedMatches: stat(stats, 'appearances'),
      };
    });
}

export function seasonLabel(year: number): string {
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
}
