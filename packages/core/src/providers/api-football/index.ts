import { LEAGUES, getLeague } from '../../leagues';
import { computeForm } from '../../standings';
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
import { ProviderError, type MatchQuery, type SportsDataProvider } from '../types';
import {
  mapMatchDetail,
  mapMeeting,
  mapPrediction,
  type AfFixtureFullResponse,
  type AfH2HResponse,
  type AfPredictionResponse,
} from './details';
import {
  mapMatch,
  mapScorer,
  mapStandingRow,
  mapTeam,
  type AfFixturesResponse,
  type AfLeaguesResponse,
  type AfScorersResponse,
  type AfStandingsResponse,
} from './mappers';
import {
  mapPlayerDetail,
  mapSquadPlayer,
  sortSquad,
  type AfPlayersResponse,
  type AfTeamInfoResponse,
} from './roster';

/**
 * api-football ids are plain numbers. Anything else cannot exist, so it is a 404 without
 * asking: a mistyped address should not cost a request.
 */
const AF_ID = /^\d{1,12}$/;

function checkId(kind: string, id: string): void {
  if (!AF_ID.test(id)) throw new ProviderError(`Invalid ${kind} id`, 404);
}

const NOT_STARTED_STATUSES = new Set(['NS', 'TBD', 'PST']);

/** api-football.com covers every competition this app knows. */
const COVERED = LEAGUES.filter((l) => l.apiFootballId !== undefined);

function afId(league: League): number {
  if (league.apiFootballId === undefined) {
    throw new ProviderError(`api-football does not cover ${league.slug}`, 404);
  }
  return league.apiFootballId;
}

interface AfEnvelope {
  errors: readonly string[] | Record<string, string>;
}

/** How long a season's start/end dates may be reused: they never change mid-season. */
const SEASON_TTL_MS = 6 * 60 * 60_000;

export interface ApiFootballProviderOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Extra options per request, e.g. Next.js `{ next: { revalidate: 60 } }`. */
  requestInit?: RequestInit | ((url: URL) => RequestInit);
  now?: () => Date;
}

/**
 * Adapter for https://www.api-football.com (v3, "API-Sports" host). A paid key covers every
 * competition this app knows, including scorer lists for Romania, Moldova and Ukraine.
 *
 * The source has no numeric matchday: single-table leagues use rounds named "Regular Season -
 * N", which `getMatches`'s `matchday` reconstructs directly since that is the source's own
 * naming convention; a round that does not exist yields an empty list rather than an error.
 *
 * `getMatch` comes from a single `/fixtures?id=` call, which already carries events, line-ups
 * and statistics inline; head-to-head and each side's recent form cost one request more each.
 * `getTeam` and `getPlayer` are implemented too; a player's `log` (per-match goals) is always
 * empty, since building it would cost one request per fixture.
 */
export class ApiFootballProvider implements SportsDataProvider {
  readonly name = 'api-football';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly requestInit: (url: URL) => RequestInit;
  private readonly now: () => Date;

  constructor(options: ApiFootballProviderOptions) {
    if (!options.apiKey) throw new ProviderError('ApiFootballProvider requires an apiKey');
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://v3.football.api-sports.io').replace(/\/$/, '');
    this.fetchFn = options.fetch ?? ((...args) => globalThis.fetch(...args));
    const init = options.requestInit ?? {};
    this.requestInit = typeof init === 'function' ? init : () => init;
    this.now = options.now ?? (() => new Date());
  }

  private async request<T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const init = this.requestInit(url);
    let res: Response;
    try {
      res = await this.fetchFn(url, {
        ...init,
        headers: { ...(init.headers ?? {}), 'x-apisports-key': this.apiKey },
      });
    } catch (cause) {
      throw new ProviderError(`Network error calling ${path}`, undefined, { cause });
    }
    if (!res.ok) {
      throw new ProviderError(`api-football responded ${res.status} for ${path}`, res.status);
    }
    const data = (await res.json()) as T & AfEnvelope;
    // A rejected request still answers 200, with the reason in `errors` (an object when there
    // is one, an empty array when there is not).
    const errors = data.errors;
    const messages = Array.isArray(errors) ? errors : Object.values(errors);
    if (messages.length > 0) {
      throw new ProviderError(`api-football rejected ${path}: ${messages.join('; ')}`, 502);
    }
    return data;
  }

  private seasons = new Map<number, { year: number; start: string; end: string; at: number }>();

  /** The current season's year (the source's "season" param) and date range, for one league. */
  private async currentSeason(id: number): Promise<{ year: number; start: string; end: string }> {
    const cached = this.seasons.get(id);
    if (cached && this.now().getTime() - cached.at < SEASON_TTL_MS) return cached;
    const data = await this.request<AfLeaguesResponse>('/leagues', { id });
    const entry = data.response[0];
    const season = entry?.seasons.find((s) => s.current) ?? entry?.seasons.at(-1);
    if (!season) throw new ProviderError(`api-football has no season data for league ${id}`, 502);
    const value = {
      year: season.year,
      start: season.start,
      end: season.end,
      at: this.now().getTime(),
    };
    this.seasons.set(id, value);
    return value;
  }

  getLeagues(): Promise<League[]> {
    return Promise.resolve([...COVERED]);
  }

  async getSeason(slug: LeagueSlug): Promise<Season> {
    const league = getLeague(slug);
    const id = afId(league);
    const season = await this.currentSeason(id);
    const rounds = await this.request<{ response: string[] }>('/fixtures/rounds', {
      league: id,
      season: season.year,
      current: 'true',
    }).catch(() => null);
    const currentMatchday = rounds?.response[0]
      ? Number.parseInt(/(\d+)\s*$/.exec(rounds.response[0])?.[1] ?? '', 10) || undefined
      : undefined;
    const start = new Date(season.start);
    const end = new Date(season.end);
    return {
      label: `${start.getUTCFullYear()}/${String(end.getUTCFullYear()).slice(-2)}`,
      startDate: season.start,
      endDate: season.end,
      ...(currentMatchday ? { currentMatchday } : {}),
      ...(league.teamCount ? { totalMatchdays: (league.teamCount - 1) * 2 } : {}),
    };
  }

  async getStandings(slug: LeagueSlug): Promise<Standings> {
    const league = getLeague(slug);
    if (!league.hasTable) {
      return {
        leagueSlug: slug,
        season: String(this.now().getUTCFullYear()),
        updatedAt: this.now().toISOString(),
        rows: [],
      };
    }
    const id = afId(league);
    const season = await this.currentSeason(id);
    const data = await this.request<AfStandingsResponse>('/standings', {
      league: id,
      season: season.year,
    });
    const groups = data.response[0]?.league.standings ?? [];
    const rows = groups.flat().map(mapStandingRow);
    const start = new Date(season.start);
    const end = new Date(season.end);
    return {
      leagueSlug: slug,
      season: `${start.getUTCFullYear()}/${String(end.getUTCFullYear()).slice(-2)}`,
      updatedAt: this.now().toISOString(),
      rows,
      ...(groups.length > 1
        ? {
            groups: groups.map((groupRows) => ({
              name: groupRows[0]?.group ?? '',
              rows: groupRows.map(mapStandingRow),
            })),
          }
        : {}),
    };
  }

  async getMatches(slug: LeagueSlug, query: MatchQuery = {}): Promise<Match[]> {
    const league = getLeague(slug);
    const id = afId(league);
    const season = await this.currentSeason(id);
    const params: Record<string, string | number | undefined> = { league: id, season: season.year };
    if (query.matchday !== undefined) {
      params.round = `Regular Season - ${query.matchday}`;
    } else {
      if (query.dateFrom) params.from = query.dateFrom;
      if (query.dateTo) params.to = query.dateTo;
    }
    const data = await this.request<AfFixturesResponse>('/fixtures', params);
    return data.response
      .map((f) => mapMatch(f, slug))
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }

  async getTopScorers(slug: LeagueSlug, limit = 10): Promise<Scorer[]> {
    const league = getLeague(slug);
    if (!league.hasScorers) return [];
    const id = afId(league);
    const season = await this.currentSeason(id);
    const data = await this.request<AfScorersResponse>('/players/topscorers', {
      league: id,
      season: season.year,
    });
    const scorers: Scorer[] = [];
    for (const entry of data.response.slice(0, limit)) {
      const scorer = mapScorer(entry, scorers.length);
      if (scorer) scorers.push(scorer);
    }
    return scorers;
  }

  async getMatchesByDate(date: string): Promise<Match[]> {
    const byId = new Map(COVERED.map((l) => [l.apiFootballId, l.slug]));
    const data = await this.request<AfFixturesResponse>('/fixtures', { date });
    return data.response
      .map((f) => {
        const slug = byId.get(f.league.id);
        return slug ? mapMatch(f, slug) : null;
      })
      .filter((m): m is Match => m !== null)
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }

  async getMatch(slug: LeagueSlug, matchId: string): Promise<MatchDetail> {
    getLeague(slug);
    checkId('match', matchId);
    const data = await this.request<AfFixtureFullResponse>('/fixtures', { id: matchId });
    const fixture = data.response[0];
    if (!fixture) throw new ProviderError(`api-football has no match ${matchId} in ${slug}`, 404);

    const homeId = fixture.teams.home.id;
    const awayId = fixture.teams.away.id;
    // A prediction is only meaningful before kick-off; asking for one after is a wasted request.
    const notStarted = NOT_STARTED_STATUSES.has(fixture.fixture.status.short);
    const [h2h, homeRecent, awayRecent, predictions] = await Promise.all([
      this.request<AfH2HResponse>('/fixtures/headtohead', {
        h2h: `${homeId}-${awayId}`,
        last: 10,
      }).catch(() => ({ response: [] }) as AfH2HResponse),
      this.request<AfFixturesResponse>('/fixtures', { team: homeId, last: 5 }).catch(
        () => ({ response: [] }) as AfFixturesResponse,
      ),
      this.request<AfFixturesResponse>('/fixtures', { team: awayId, last: 5 }).catch(
        () => ({ response: [] }) as AfFixturesResponse,
      ),
      notStarted
        ? this.request<AfPredictionResponse>('/predictions', { fixture: matchId }).catch(
            () => ({ response: [] }) as AfPredictionResponse,
          )
        : Promise.resolve({ response: [] } as AfPredictionResponse),
    ]);

    const meetings = h2h.response.map(mapMeeting).sort((a, b) => b.date.localeCompare(a.date));
    // Team form, best effort: the most recent matches across every competition, not only this
    // one, since that is what "last N" gives without a second request per competition.
    const recent = [...homeRecent.response, ...awayRecent.response].map((f) => mapMatch(f, slug));
    const form = computeForm(recent);

    return mapMatchDetail(
      fixture,
      slug,
      meetings,
      { home: form.get(String(homeId)) ?? [], away: form.get(String(awayId)) ?? [] },
      mapPrediction(predictions.response[0]),
    );
  }

  /** The whole squad's season statistics, in the given league. `/players` pages at 20. */
  private async fetchSquad(
    teamId: string,
    seasonYear: number,
  ): Promise<AfPlayersResponse['response']> {
    const first = await this.request<AfPlayersResponse>('/players', {
      team: teamId,
      season: seasonYear,
      page: 1,
    });
    const pages = first.paging.total;
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
        this.request<AfPlayersResponse>('/players', {
          team: teamId,
          season: seasonYear,
          page: i + 2,
        }),
      ),
    );
    return [first, ...rest].flatMap((page) => page.response);
  }

  async getTeam(slug: LeagueSlug, teamId: string): Promise<TeamDetail> {
    const league = getLeague(slug);
    checkId('team', teamId);
    const id = afId(league);
    const season = await this.currentSeason(id);
    const [info, results, fixtures, squad] = await Promise.all([
      this.request<AfTeamInfoResponse>('/teams', { id: teamId }),
      this.request<AfFixturesResponse>('/fixtures', { team: teamId, last: 10 }).catch(
        () => ({ response: [] }) as AfFixturesResponse,
      ),
      this.request<AfFixturesResponse>('/fixtures', { team: teamId, next: 10 }).catch(
        () => ({ response: [] }) as AfFixturesResponse,
      ),
      this.fetchSquad(teamId, season.year).catch(() => []),
    ]);
    const teamInfo = info.response[0];
    if (!teamInfo) throw new ProviderError(`api-football has no team ${teamId} in ${slug}`, 404);

    return {
      team: mapTeam(teamInfo.team),
      leagueSlug: slug,
      ...(teamInfo.venue?.name ? { venue: teamInfo.venue.name } : {}),
      results: results.response
        .map((f) => mapMatch(f, slug))
        .sort((a, b) => b.kickoff.localeCompare(a.kickoff)),
      fixtures: fixtures.response
        .map((f) => mapMatch(f, slug))
        .sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
      squad: sortSquad(squad.map((entry) => mapSquadPlayer(entry, id))),
    };
  }

  async getPlayer(slug: LeagueSlug, playerId: string): Promise<PlayerDetail> {
    const league = getLeague(slug);
    checkId('player', playerId);
    const id = afId(league);
    const season = await this.currentSeason(id);
    const data = await this.request<AfPlayersResponse>('/players', {
      id: playerId,
      season: season.year,
    });
    const entry = data.response[0];
    if (!entry) throw new ProviderError(`api-football has no player ${playerId} in ${slug}`, 404);
    return mapPlayerDetail(entry, id, slug);
  }
}
