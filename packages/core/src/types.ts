/**
 * Domain models shared across every client (web, mobile, API routes).
 * Keep this file free of framework imports.
 */

export type LeagueSlug = 'premier-league' | 'la-liga' | 'serie-a' | 'bundesliga' | 'ligue-1';

export interface LeagueZones {
  /** Number of positions that qualify for the Champions League. */
  championsLeague: number;
  /** Number of positions after CL that qualify for the Europa League. */
  europaLeague: number;
  /** Number of positions after EL that qualify for the Conference League. */
  conferenceLeague: number;
  /** Number of positions from the bottom that are relegated. */
  relegation: number;
  /** Number of positions above relegation that go to a play-off (0 if none). */
  relegationPlayoff: number;
}

export interface League {
  slug: LeagueSlug;
  name: string;
  /** Compact label for chips and tight columns, e.g. "PL". */
  shortName: string;
  country: string;
  /** ISO 3166-1 alpha-2 */
  countryCode: string;
  /** League logo, when the data source publishes one. */
  logoUrl?: string;
  /** football-data.org competition code */
  externalCode: string;
  teamCount: number;
  /** Brand colours for theming league pages. */
  colors: {
    primary: string;
    secondary: string;
  };
  zones: LeagueZones;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  /** Three-letter abbreviation */
  tla: string;
  crestUrl?: string;
  colors?: {
    primary: string;
    secondary: string;
  };
}

export type FormResult = 'W' | 'D' | 'L';

export interface StandingRow {
  position: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Most recent result last. */
  form: FormResult[];
}

export interface Standings {
  leagueSlug: LeagueSlug;
  season: string;
  updatedAt: string;
  rows: StandingRow[];
}

export type MatchStatus = 'scheduled' | 'live' | 'paused' | 'finished' | 'postponed' | 'cancelled';

export interface Score {
  home: number | null;
  away: number | null;
}

export interface Match {
  id: string;
  leagueSlug: LeagueSlug;
  matchday: number;
  /** ISO-8601 UTC timestamp */
  kickoff: string;
  status: MatchStatus;
  homeTeam: Team;
  awayTeam: Team;
  score: Score;
  halfTimeScore?: Score;
  /** Only present while live. */
  minute?: number;
  /** Provider-formatted clock while live, e.g. "45'+2'". Preferred over `minute` for display. */
  displayClock?: string;
  /** Goals and red cards, in match order. Absent when the provider has no event data. */
  events?: MatchEvent[];
  venue?: string;
}

export type MatchEventType = 'goal' | 'penalty-goal' | 'own-goal' | 'red-card';

export interface MatchEvent {
  type: MatchEventType;
  /** Display minute, e.g. "57'" or "90'+3'". */
  minute: string;
  /** Team credited with the event (for own goals: the team that benefits). */
  teamId: string;
  player: string;
}

export interface Player {
  id: string;
  name: string;
  nationality?: string;
  position?: string;
}

export interface Scorer {
  rank: number;
  player: Player;
  team: Team;
  goals: number;
  assists: number;
  /** Not every source reports penalties. */
  penalties?: number;
  playedMatches: number;
}

export interface Season {
  label: string;
  startDate: string;
  endDate: string;
  /** Not every source has a matchday concept. */
  currentMatchday?: number;
  totalMatchdays: number;
}

/* ---------- Detail views (match, team, player) ---------- */

export interface MatchStat {
  key: string;
  label: string;
  home: number;
  away: number;
  /** Present when the values are percentages. */
  unit?: '%';
}

export type TimelineKind =
  'goal' | 'penalty-goal' | 'own-goal' | 'yellow-card' | 'red-card' | 'substitution';

export interface TimelineEvent {
  /** Display minute, e.g. "57'" or "90'+3'". */
  minute: string;
  side: 'home' | 'away';
  kind: TimelineKind;
  /** Main actor: scorer, booked player, or player coming on. */
  player: string;
  /** Secondary actor: for substitutions, the player going off. */
  detail?: string;
}

export interface PastMeeting {
  id: string;
  date: string;
  homeTeam: Team;
  awayTeam: Team;
  score: Score;
}

export interface MatchDetail {
  match: Match;
  attendance?: number;
  stats: MatchStat[];
  timeline: TimelineEvent[];
  headToHead: {
    /** Source-provided one-liner, e.g. "LIV leads series 4-1". */
    summary?: string;
    meetings: PastMeeting[];
  };
}

export interface SquadPlayer {
  id: string;
  name: string;
  number?: string;
  /** Broad role: Goalkeeper, Defender, Midfielder, Forward. */
  position?: string;
  age?: number;
  nationality?: string;
  appearances: number;
  goals: number;
  assists: number;
}

export interface TeamDetail {
  team: Team;
  leagueSlug: LeagueSlug;
  /** e.g. "1st in English Premier League" */
  standingSummary?: string;
  venue?: string;
  /** Played matches this season, most recent first. */
  results: Match[];
  /** Upcoming matches, soonest first. */
  fixtures: Match[];
  squad: SquadPlayer[];
}

export interface PlayerMatchLog {
  matchId: string;
  date?: string;
  opponent?: string;
  goals: number;
  assists: number;
}

export interface PlayerDetail {
  player: SquadPlayer & {
    headshotUrl?: string;
    height?: string;
    dateOfBirth?: string;
    shots?: number;
  };
  team?: Team;
  leagueSlug: LeagueSlug;
  /** This season's appearances in date order. */
  log: PlayerMatchLog[];
}
