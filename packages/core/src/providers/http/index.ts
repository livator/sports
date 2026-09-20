import type {
  League,
  LeagueSlug,
  Match,
  MatchDetail,
  PlayerDetail,
  Scorer,
  Season,
  Standings,
  TeamDetail,
} from '../../types';
import {
  ProviderError,
  type MatchQuery,
  type SportsDataProvider,
  type StandingsOptions,
} from '../types';

export interface HttpProviderOptions {
  /** Base URL of the sports web app, e.g. https://sports.example.com */
  baseUrl: string;
  fetch?: typeof fetch;
  requestInit?: RequestInit;
}

/**
 * Talks to the web app's own `/api/v1` routes. This is what the mobile apps use,
 * so API keys never ship inside a client bundle and the server can cache upstream calls.
 */
export class HttpProvider implements SportsDataProvider {
  readonly name = 'http';
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly requestInit: RequestInit;

  constructor(options: HttpProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.requestInit = options.requestInit ?? {};
  }

  private async get<T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const res = await this.fetchFn(url, this.requestInit);
    if (!res.ok) throw new ProviderError(`API responded ${res.status} for ${path}`, res.status);
    return (await res.json()) as T;
  }

  getLeagues(): Promise<League[]> {
    return this.get('/leagues');
  }

  getSeason(league: LeagueSlug): Promise<Season> {
    return this.get(`/leagues/${league}/season`);
  }

  getStandings(league: LeagueSlug, options: StandingsOptions = {}): Promise<Standings> {
    return this.get(`/leagues/${league}/standings`, {
      form: options.includeForm === false ? 0 : undefined,
    });
  }

  getMatches(league: LeagueSlug, query: MatchQuery = {}): Promise<Match[]> {
    return this.get(`/leagues/${league}/matches`, {
      matchday: query.matchday,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  getTopScorers(league: LeagueSlug, limit?: number): Promise<Scorer[]> {
    return this.get(`/leagues/${league}/scorers`, { limit });
  }

  getMatchesByDate(date: string): Promise<Match[]> {
    return this.get('/matches', { date });
  }

  getMatch(league: LeagueSlug, matchId: string): Promise<MatchDetail> {
    return this.get(`/leagues/${league}/matches/${encodeURIComponent(matchId)}`);
  }

  getTeam(league: LeagueSlug, teamId: string): Promise<TeamDetail> {
    return this.get(`/leagues/${league}/teams/${encodeURIComponent(teamId)}`);
  }

  getPlayer(league: LeagueSlug, playerId: string): Promise<PlayerDetail> {
    return this.get(`/leagues/${league}/players/${encodeURIComponent(playerId)}`);
  }
}
