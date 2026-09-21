/**
 * Domain models shared across every client (web, mobile, API routes).
 * Keep this file free of framework imports.
 */

/**
 * Every competition the app knows. The name "league" is historical: this also covers
 * UEFA club competitions and national-team competitions.
 */
export type LeagueSlug =
  // Top five domestic leagues
  | 'premier-league'
  | 'la-liga'
  | 'serie-a'
  | 'bundesliga'
  | 'ligue-1'
  // UEFA club competitions
  | 'champions-league'
  | 'europa-league'
  | 'conference-league'
  // National teams
  | 'nations-league'
  | 'euro-qualifying'
  | 'friendlies'
  // Other European domestic leagues
  | 'eredivisie'
  | 'primeira-liga'
  | 'belgian-pro-league'
  | 'super-lig'
  | 'scottish-premiership'
  | 'super-league-greece'
  | 'austrian-bundesliga'
  | 'danish-superliga'
  | 'allsvenskan'
  | 'eliteserien'
  | 'russian-premier-league';

/** How competitions are grouped in navigation. */
export type CompetitionCategory = 'uefa' | 'national' | 'top5' | 'more';

/**
 * What finishing in a table position means. The first five are domestic-league outcomes;
 * the last three cover league phases, groups and lower divisions.
 */
export type ZoneKind =
  | 'champions-league'
  | 'europa-league'
  | 'conference-league'
  | 'relegation-playoff'
  | 'relegation'
  | 'advance'
  | 'playoff'
  | 'eliminated';

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
  category: CompetitionCategory;
  /** Country for domestic leagues, "Europe" for UEFA and national-team competitions. */
  country: string;
  /** ISO 3166-1 alpha-2, or "EU" for continental competitions. */
  countryCode: string;
  /** Logo, when the data source publishes one. */
  logoUrl?: string;
  /** False for competitions with no standings at all, such as friendlies. */
  hasTable: boolean;
  /** False where the data source publishes no scorer list. */
  hasScorers: boolean;
  /** football-data.org competition code, for the competitions its free tier covers. */
  externalCode?: string;
  /** Clubs in a single-table league. Absent for cups and grouped competitions. */
  teamCount?: number;
  /**
   * Fallback qualification places by position, used only when a data source does not say
   * what each table position means. ESPN does, so most competitions leave this out.
   */
  zones?: LeagueZones;
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
  /**
   * What this position means, when the data source says so. `null` means "nothing special";
   * `undefined` means the source does not know, and callers may fall back to `League.zones`.
   */
  zone?: ZoneKind | null;
}

export interface StandingsGroup {
  /** e.g. "Group A1" */
  name: string;
  rows: StandingRow[];
}

export interface Standings {
  leagueSlug: LeagueSlug;
  season: string;
  updatedAt: string;
  /** Every row. For grouped competitions this is all groups concatenated, positions per group. */
  rows: StandingRow[];
  /** Present only when the competition is split into more than one table. */
  groups?: StandingsGroup[];
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
  /** Only meaningful for single-table leagues. */
  totalMatchdays?: number;
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

export interface LineupPlayer {
  id: string;
  name: string;
  /** Surname or short form, for tight spaces such as a pitch diagram. */
  shortName: string;
  number?: string;
  subbedIn: boolean;
  subbedOut: boolean;
}

export interface TeamLineup {
  /** e.g. "4-2-3-1" */
  formation?: string;
  /**
   * Starting XI by line, goalkeeper first, forwards last. Each line runs from the team's own
   * left to its right; clients mirror it for whichever end the team is drawn at.
   */
  rows: LineupPlayer[][];
  bench: LineupPlayer[];
}

export interface MatchLineups {
  home: TeamLineup;
  away: TeamLineup;
}

export interface MatchDetail {
  match: Match;
  attendance?: number;
  stats: MatchStat[];
  timeline: TimelineEvent[];
  /** Present once the source has published the teams, usually about an hour before kick-off. */
  lineups?: MatchLineups;
  /** Each side's latest results before this match, oldest first. */
  form?: { home: FormResult[]; away: FormResult[] };
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
  /** Latest headlines about this team, when the source has a feed for it. */
  news?: NewsArticle[];
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

/* ---------- News ---------- */

/**
 * A headline with its summary. For stories from an outside publisher the full text stays
 * with them: clients show this much and link to `sourceUrl`, and never republish the body.
 * Only articles written by our own staff carry a `body`.
 */
export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  /** ISO-8601 UTC timestamp */
  publishedAt: string;
  /** Competition the story belongs to, when it maps onto one we know. */
  leagueSlug?: LeagueSlug;
  /** Publisher's own section label, used when `leagueSlug` is absent. */
  tag?: string;
  author?: string;
  imageUrl?: string;
  imageCredit?: string;
  sourceName: string;
  sourceUrl: string;
  /** Our own articles only. Plain text, paragraphs separated by a blank line. */
  body?: string;
  /** Our own articles only: a short label such as "Match report". */
  label?: string;
  /** Our own articles only: pinned to the top of news lists. */
  featured?: boolean;
  /** False when the editor closed the thread. Absent means open. */
  commentsOpen?: boolean;
}

/** Ids of articles written in our own console start with this; publisher ids are numeric. */
export const OWN_ARTICLE_PREFIX = 'ps-';
export const isOwnArticleId = (id: string): boolean => /^ps-[a-z0-9]{8,24}$/.test(id);
