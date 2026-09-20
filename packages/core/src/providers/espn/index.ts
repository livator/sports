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
import { monthsBetween, toIsoDate } from '../../utils/format';
import {
  ProviderError,
  type MatchQuery,
  type SportsDataProvider,
  type StandingsOptions,
} from '../types';
import {
  mapMatchDetail,
  mapPlayerDetail,
  mapSquadPlayer,
  sortSquad,
  type EspnAthleteProfile,
  type EspnGameLog,
  type EspnRosterAthlete,
  type EspnSummary,
} from './details';
import {
  mapEvent,
  mapScorers,
  mapStandings,
  mapTeam,
  seasonLabel,
  type EspnEvent,
  type EspnScoreboard,
  type EspnStandings,
  type EspnStatistics,
  type EspnTeam,
} from './mappers';

const ESPN_CODES: Record<LeagueSlug, string> = {
  'premier-league': 'eng.1',
  'la-liga': 'esp.1',
  'serie-a': 'ita.1',
  bundesliga: 'ger.1',
  'ligue-1': 'fra.1',
};

/** Upper bound on month requests for a single getMatches call. */
const MAX_MONTHS = 12;

export interface EspnProviderOptions {
  baseUrl?: string;
  /** Host for the athlete endpoints, which live on a different ESPN service. */
  webBaseUrl?: string;
  fetch?: typeof fetch;
  /**
   * Extra options for every request, e.g. Next.js `{ next: { revalidate: 30 } }`.
   * Pass a function to vary them per URL (live scoreboards want a shorter cache than tables).
   */
  requestInit?: RequestInit | ((url: URL) => RequestInit);
  /** Clock, injectable for tests. */
  now?: () => Date;
}

/**
 * Adapter for ESPN's public site API. No key required.
 * The API is undocumented: it accepts a single day (YYYYMMDD), month (YYYYMM) or
 * year (YYYY) in `dates`, but rejects arbitrary ranges, so ranges are fetched per month.
 * It has no matchday concept, so `MatchQuery.matchday` is ignored.
 */
export class EspnProvider implements SportsDataProvider {
  readonly name = 'espn';
  private readonly baseUrl: string;
  private readonly webBaseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly requestInit: (url: URL) => RequestInit;
  private readonly now: () => Date;

  constructor(options: EspnProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'https://site.api.espn.com').replace(/\/$/, '');
    this.webBaseUrl = (options.webBaseUrl ?? 'https://site.web.api.espn.com').replace(/\/$/, '');
    this.fetchFn = options.fetch ?? ((...args) => globalThis.fetch(...args));
    const init = options.requestInit ?? {};
    this.requestInit = typeof init === 'function' ? init : () => init;
    this.now = options.now ?? (() => new Date());
  }

  private async request<T>(
    path: string,
    params: Record<string, string | number | boolean> = {},
    base = this.baseUrl,
  ): Promise<T> {
    const url = new URL(`${base}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    let res: Response;
    try {
      res = await this.fetchFn(url, this.requestInit(url));
    } catch (cause) {
      throw new ProviderError(`Network error calling ${path}`, undefined, { cause });
    }
    if (!res.ok) throw new ProviderError(`ESPN responded ${res.status} for ${path}`, res.status);
    return (await res.json()) as T;
  }

  private async scoreboard(slug: LeagueSlug, dates?: string): Promise<EspnScoreboard> {
    return this.request<EspnScoreboard>(
      `/apis/site/v2/sports/soccer/${ESPN_CODES[slug]}/scoreboard`,
      dates ? { dates, limit: 400 } : {},
    );
  }

  private async matchesFor(slug: LeagueSlug, dates: string): Promise<Match[]> {
    const data = await this.scoreboard(slug, dates);
    return (data.events ?? [])
      .map((e) => mapEvent(e, slug))
      .filter((m): m is Match => m !== null)
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }

  getLeagues(): Promise<League[]> {
    return Promise.resolve([...LEAGUES]);
  }

  async getSeason(slug: LeagueSlug): Promise<Season> {
    const league = getLeague(slug);
    const data = await this.scoreboard(slug);
    const season = data.leagues?.[0]?.season;
    if (!season) throw new ProviderError(`ESPN returned no season for ${slug}`);
    return {
      label: seasonLabel(season.year),
      startDate: season.startDate.slice(0, 10),
      endDate: season.endDate.slice(0, 10),
      totalMatchdays: (league.teamCount - 1) * 2,
    };
  }

  async getStandings(slug: LeagueSlug, options: StandingsOptions = {}): Promise<Standings> {
    getLeague(slug);
    const now = this.now();
    const thisMonth = toIsoDate(now).slice(0, 7);
    const lastMonth = toIsoDate(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
    ).slice(0, 7);

    const [data, recent] = await Promise.all([
      this.request<EspnStandings>(`/apis/v2/sports/soccer/${ESPN_CODES[slug]}/standings`),
      // Form is not part of the standings feed; derive it from recent results. Best effort.
      options.includeForm === false
        ? Promise.resolve([] as Match[])
        : Promise.all([lastMonth, thisMonth].map((m) => this.matchesFor(slug, m.replace('-', ''))))
            .then((months) => months.flat())
            .catch(() => [] as Match[]),
    ]);

    const form = computeForm(recent);
    const rows = mapStandings(data).map((row) => ({ ...row, form: form.get(row.team.id) ?? [] }));
    return {
      leagueSlug: slug,
      season: seasonLabel(data.season?.year ?? now.getUTCFullYear()),
      updatedAt: now.toISOString(),
      rows,
    };
  }

  async getMatches(slug: LeagueSlug, query: MatchQuery = {}): Promise<Match[]> {
    getLeague(slug);
    const today = toIsoDate(this.now());
    const from = query.dateFrom ?? query.dateTo ?? `${today.slice(0, 7)}-01`;
    const to = query.dateTo ?? query.dateFrom ?? today;

    if (from === to) {
      return this.matchesFor(slug, from.replaceAll('-', ''));
    }

    const months = monthsBetween(from, to).slice(0, MAX_MONTHS);
    const results = await Promise.all(months.map((m) => this.matchesFor(slug, m.replace('-', ''))));
    return results
      .flat()
      .filter((m) => {
        const date = m.kickoff.slice(0, 10);
        return (
          (!query.dateFrom || date >= query.dateFrom) && (!query.dateTo || date <= query.dateTo)
        );
      })
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }

  async getTopScorers(slug: LeagueSlug, limit = 10): Promise<Scorer[]> {
    getLeague(slug);
    const data = await this.request<EspnStatistics>(
      `/apis/site/v2/sports/soccer/${ESPN_CODES[slug]}/statistics`,
    );
    // The statistics feed only carries full club names; the table has the short names.
    const table = await this.request<EspnStandings>(
      `/apis/v2/sports/soccer/${ESPN_CODES[slug]}/standings`,
    ).catch(() => null);
    const clubs = new Map((table ? mapStandings(table) : []).map((row) => [row.team.id, row.team]));
    return mapScorers(data, limit).map((s) => ({ ...s, team: clubs.get(s.team.id) ?? s.team }));
  }

  async getMatchesByDate(date: string): Promise<Match[]> {
    const dates = date.replaceAll('-', '');
    const all = await Promise.all(LEAGUES.map((l) => this.matchesFor(l.slug, dates)));
    return all.flat().sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }

  async getMatch(slug: LeagueSlug, matchId: string): Promise<MatchDetail> {
    getLeague(slug);
    const data = await this.request<EspnSummary>(
      `/apis/site/v2/sports/soccer/${ESPN_CODES[slug]}/summary`,
      { event: matchId },
    );
    const detail = mapMatchDetail(data, slug, matchId);
    if (!detail) throw new ProviderError(`ESPN has no match ${matchId} in ${slug}`, 404);
    return detail;
  }

  async getTeam(slug: LeagueSlug, teamId: string): Promise<TeamDetail> {
    getLeague(slug);
    const base = `/apis/site/v2/sports/soccer/${ESPN_CODES[slug]}/teams/${encodeURIComponent(teamId)}`;
    type TeamResponse = {
      team?: EspnTeam & { standingSummary?: string; franchise?: { venue?: { fullName?: string } } };
    };
    type Schedule = { events?: EspnEvent[] };
    type Roster = { athletes?: EspnRosterAthlete[] };

    // The team itself is required; the rest degrades to empty lists.
    const [info, played, upcoming, roster] = await Promise.all([
      this.request<TeamResponse>(base),
      this.request<Schedule>(`${base}/schedule`).catch(() => ({}) as Schedule),
      this.request<Schedule>(`${base}/schedule`, { fixture: true }).catch(() => ({}) as Schedule),
      this.request<Roster>(`${base}/roster`).catch(() => ({}) as Roster),
    ]);
    if (!info.team) throw new ProviderError(`ESPN has no team ${teamId} in ${slug}`, 404);

    const toMatches = (schedule: Schedule) =>
      (schedule.events ?? []).map((e) => mapEvent(e, slug)).filter((m): m is Match => m !== null);
    const venue = info.team.franchise?.venue?.fullName;

    return {
      team: mapTeam(info.team),
      leagueSlug: slug,
      ...(info.team.standingSummary ? { standingSummary: info.team.standingSummary } : {}),
      ...(venue ? { venue } : {}),
      results: toMatches(played)
        .filter((m) => m.status !== 'scheduled')
        .sort((a, b) => b.kickoff.localeCompare(a.kickoff)),
      fixtures: toMatches(upcoming)
        .filter((m) => m.status === 'scheduled' || m.status === 'postponed')
        .sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
      squad: sortSquad((roster.athletes ?? []).map(mapSquadPlayer)),
    };
  }

  async getPlayer(slug: LeagueSlug, playerId: string): Promise<PlayerDetail> {
    getLeague(slug);
    const base = `/apis/common/v3/sports/soccer/${ESPN_CODES[slug]}/athletes/${encodeURIComponent(playerId)}`;
    const [profile, log] = await Promise.all([
      this.request<EspnAthleteProfile>(base, {}, this.webBaseUrl),
      this.request<EspnGameLog>(`${base}/gamelog`, {}, this.webBaseUrl).catch(() => null),
    ]);
    const detail = mapPlayerDetail(profile, log, slug);
    if (!detail) throw new ProviderError(`ESPN has no player ${playerId} in ${slug}`, 404);
    return detail;
  }
}
