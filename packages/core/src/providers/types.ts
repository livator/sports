import type { League, LeagueSlug, Match, Scorer, Season, Standings } from '../types';

export interface MatchQuery {
  /** Restrict to a single matchday. */
  matchday?: number;
  /** ISO date (YYYY-MM-DD) lower bound, inclusive. */
  dateFrom?: string;
  /** ISO date (YYYY-MM-DD) upper bound, inclusive. */
  dateTo?: string;
}

/**
 * The single seam between the UI and the outside world.
 * Implement this to plug in any data source (REST API, GraphQL, local DB, fixtures).
 */
export interface SportsDataProvider {
  readonly name: string;
  getLeagues(): Promise<League[]>;
  getSeason(league: LeagueSlug): Promise<Season>;
  getStandings(league: LeagueSlug): Promise<Standings>;
  getMatches(league: LeagueSlug, query?: MatchQuery): Promise<Match[]>;
  getTopScorers(league: LeagueSlug, limit?: number): Promise<Scorer[]>;
  /** Matches across all leagues for a given ISO date (YYYY-MM-DD). */
  getMatchesByDate(date: string): Promise<Match[]>;
}

export class ProviderError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ProviderError';
    this.status = status;
  }
}
