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
  country: string;
  /** ISO 3166-1 alpha-2 */
  countryCode: string;
  /** Emoji flag for lightweight rendering without image assets. */
  flag: string;
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
  venue?: string;
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
  penalties: number;
  playedMatches: number;
}

export interface Season {
  label: string;
  startDate: string;
  endDate: string;
  currentMatchday: number;
  totalMatchdays: number;
}
