import { LEAGUES, getLeague } from '../../leagues';

/** football-data.org's free tier covers only some competitions. */
const COVERED = LEAGUES.filter((l) => l.externalCode);
import type { League, LeagueSlug, Match, Scorer, Season, Standings } from '../../types';
import { ProviderError, type MatchQuery, type SportsDataProvider } from '../types';
import {
  mapMatch,
  mapScorer,
  mapStandingRow,
  type FdCompetition,
  type FdMatchesResponse,
  type FdScorersResponse,
  type FdStandingsResponse,
} from './mappers';

export interface FootballDataProviderOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Extra options merged into every request, e.g. Next.js `{ next: { revalidate: 60 } }`. */
  requestInit?: RequestInit;
}

/**
 * Adapter for https://www.football-data.org (v4). Free tier covers the top-5 leagues
 * with a 10 req/min limit, so callers should cache aggressively.
 */
export class FootballDataProvider implements SportsDataProvider {
  readonly name = 'football-data.org';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly requestInit: RequestInit;

  constructor(options: FootballDataProviderOptions) {
    if (!options.apiKey) throw new ProviderError('FootballDataProvider requires an apiKey');
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://api.football-data.org/v4').replace(/\/$/, '');
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.requestInit = options.requestInit ?? {};
  }

  private async request<T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    let res: Response;
    try {
      res = await this.fetchFn(url, {
        ...this.requestInit,
        headers: { ...(this.requestInit.headers ?? {}), 'X-Auth-Token': this.apiKey },
      });
    } catch (cause) {
      throw new ProviderError(`Network error calling ${path}`, undefined, { cause });
    }
    if (!res.ok) {
      throw new ProviderError(`football-data.org responded ${res.status} for ${path}`, res.status);
    }
    return (await res.json()) as T;
  }

  private code(league: League): string {
    if (!league.externalCode) {
      throw new ProviderError(`football-data.org does not cover ${league.slug}`, 404);
    }
    return league.externalCode;
  }

  getLeagues(): Promise<League[]> {
    return Promise.resolve([...COVERED]);
  }

  async getSeason(slug: LeagueSlug): Promise<Season> {
    const league = getLeague(slug);
    const data = await this.request<FdCompetition>(`/competitions/${this.code(league)}`);
    const cs = data.currentSeason;
    const start = new Date(cs.startDate);
    const end = new Date(cs.endDate);
    return {
      label: `${start.getUTCFullYear()}/${String(end.getUTCFullYear()).slice(-2)}`,
      startDate: cs.startDate,
      endDate: cs.endDate,
      currentMatchday: cs.currentMatchday ?? 1,
      ...(league.teamCount ? { totalMatchdays: (league.teamCount - 1) * 2 } : {}),
    };
  }

  async getStandings(slug: LeagueSlug): Promise<Standings> {
    const league = getLeague(slug);
    const data = await this.request<FdStandingsResponse>(
      `/competitions/${this.code(league)}/standings`,
    );
    const total = data.standings.find((s) => s.type === 'TOTAL') ?? data.standings[0];
    const start = new Date(data.season.startDate);
    const end = new Date(data.season.endDate);
    return {
      leagueSlug: slug,
      season: `${start.getUTCFullYear()}/${String(end.getUTCFullYear()).slice(-2)}`,
      updatedAt: new Date().toISOString(),
      rows: (total?.table ?? []).map(mapStandingRow),
    };
  }

  async getMatches(slug: LeagueSlug, query: MatchQuery = {}): Promise<Match[]> {
    const league = getLeague(slug);
    const data = await this.request<FdMatchesResponse>(
      `/competitions/${this.code(league)}/matches`,
      { matchday: query.matchday, dateFrom: query.dateFrom, dateTo: query.dateTo },
    );
    return data.matches.map((m) => mapMatch(m, slug));
  }

  async getTopScorers(slug: LeagueSlug, limit = 10): Promise<Scorer[]> {
    const league = getLeague(slug);
    const data = await this.request<FdScorersResponse>(
      `/competitions/${this.code(league)}/scorers`,
      { limit },
    );
    return data.scorers.map(mapScorer);
  }

  async getMatchesByDate(date: string): Promise<Match[]> {
    const codes = COVERED.map((l) => l.externalCode).join(',');
    const data = await this.request<FdMatchesResponse>('/matches', {
      competitions: codes,
      dateFrom: date,
      dateTo: date,
    });
    const byCode = new Map(COVERED.map((l) => [l.externalCode, l.slug]));
    return data.matches
      .map((m) => {
        const slug = m.competition ? byCode.get(m.competition.code) : undefined;
        return slug ? mapMatch(m, slug) : null;
      })
      .filter((m): m is Match => m !== null)
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }
}
