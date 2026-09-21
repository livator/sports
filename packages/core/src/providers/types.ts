import type {
  League,
  LeagueSlug,
  Match,
  MatchDetail,
  NewsArticle,
  PlayerDetail,
  Scorer,
  Season,
  Standings,
  TeamDetail,
} from '../types';

export interface MatchQuery {
  /** Restrict to a single matchday. */
  matchday?: number;
  /** ISO date (YYYY-MM-DD) lower bound, inclusive. */
  dateFrom?: string;
  /** ISO date (YYYY-MM-DD) upper bound, inclusive. */
  dateTo?: string;
}

export interface StandingsOptions {
  /**
   * Include each team's recent form. Some sources need extra requests for it,
   * so compact views should pass false. Defaults to true.
   */
  includeForm?: boolean;
}

/**
 * The single seam between the UI and the outside world.
 * Implement this to plug in any data source (REST API, GraphQL, local DB, fixtures).
 */
export interface SportsDataProvider {
  readonly name: string;
  getLeagues(): Promise<League[]>;
  getSeason(league: LeagueSlug): Promise<Season>;
  getStandings(league: LeagueSlug, options?: StandingsOptions): Promise<Standings>;
  getMatches(league: LeagueSlug, query?: MatchQuery): Promise<Match[]>;
  getTopScorers(league: LeagueSlug, limit?: number): Promise<Scorer[]>;
  /** Matches across all leagues for a given ISO date (YYYY-MM-DD). */
  getMatchesByDate(date: string): Promise<Match[]>;

  /*
   * Detail views are optional: not every source can serve them. Callers must check
   * for the method and degrade gracefully when it is missing.
   */
  getMatch?(league: LeagueSlug, matchId: string): Promise<MatchDetail>;
  getTeam?(league: LeagueSlug, teamId: string): Promise<TeamDetail>;
  getPlayer?(league: LeagueSlug, playerId: string): Promise<PlayerDetail>;

  /** Latest headlines across the given competitions, newest first. */
  getNews?(leagues: readonly LeagueSlug[], limit?: number): Promise<NewsArticle[]>;
  getArticle?(articleId: string): Promise<NewsArticle>;
}

export class ProviderError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ProviderError';
    this.status = status;
  }
}
