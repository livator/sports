import { LEAGUES, getLeague } from '../../leagues';
import { computeForm } from '../../standings';
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
import { mapNewsItem, mergeNews, type EspnNewsFeed, type EspnNewsHeadlines } from './news';
import {
  mapEvent,
  mapScorers,
  mapStandings,
  mapStandingsGroups,
  mapTeam,
  seasonLabel,
  type EspnEvent,
  type EspnScoreboard,
  type EspnStandings,
  type EspnStatistics,
  type EspnTeam,
} from './mappers';

/**
 * ESPN's competition codes. A league without one is not served by this provider: ESPN has no
 * current data for it, and another source covers it (see CompositeProvider).
 */
const ESPN_CODES: Partial<Record<LeagueSlug, string>> = {
  'champions-league': 'uefa.champions',
  'europa-league': 'uefa.europa',
  'conference-league': 'uefa.europa.conf',
  'nations-league': 'uefa.nations',
  'euro-qualifying': 'uefa.euroq',
  friendlies: 'fifa.friendly',
  'premier-league': 'eng.1',
  'la-liga': 'esp.1',
  'serie-a': 'ita.1',
  bundesliga: 'ger.1',
  'ligue-1': 'fra.1',
  eredivisie: 'ned.1',
  'primeira-liga': 'por.1',
  'belgian-pro-league': 'bel.1',
  'super-lig': 'tur.1',
  'scottish-premiership': 'sco.1',
  'super-league-greece': 'gre.1',
  'austrian-bundesliga': 'aut.1',
  'danish-superliga': 'den.1',
  allsvenskan: 'swe.1',
  eliteserien: 'nor.1',
  'russian-premier-league': 'rus.1',
};

const COVERED = LEAGUES.filter((l) => ESPN_CODES[l.slug] !== undefined);

/** The code for a league, or a 404 for one this provider does not serve. */
function codeOf(slug: LeagueSlug): string {
  const code = ESPN_CODES[slug];
  if (!code) throw new ProviderError(`ESPN does not cover ${slug}`, 404);
  return code;
}

/**
 * ESPN ids are plain numbers. Anything else cannot exist, so it is a 404 without asking: a
 * mistyped address should not cost a request, and ESPN can take very long to reject one.
 */
const ESPN_ID = /^\d{1,12}$/;

function checkId(kind: string, id: string): void {
  if (!ESPN_ID.test(id)) throw new ProviderError(`Invalid ${kind} id`, 404);
}

const TRAILING_SLASH = /\/$/;

/** How long the list of European national teams is reused. */
const EUROPE_TTL_MS = 6 * 60 * 60_000;

/** Headlines shown on a team page. Clips are dropped after fetching, so ask for more. */
const TEAM_NEWS_LIMIT = 3;
const TEAM_NEWS_FETCH = 12;
/** Most competition feeds merged into one news list. */
const MAX_NEWS_FEEDS = 6;
/** Feeds behind an unfiltered news list: the biggest stage plus the top five leagues. */
const DEFAULT_NEWS_FEEDS: readonly LeagueSlug[] = [
  'champions-league',
  'premier-league',
  'la-liga',
  'serie-a',
  'bundesliga',
  'ligue-1',
];

/**
 * No request may outlive this. Node's own limits are about five minutes each for the headers
 * and for the body, and a framework that waits for background refreshes before answering
 * (Next.js does) would hold a page for that long because of one stuck connection.
 */
const REQUEST_TIMEOUT_MS = 8_000;

/** Upper bound on month requests for a single getMatches call. */
const MAX_MONTHS = 12;

export interface EspnProviderOptions {
  baseUrl?: string;
  /** Host for the athlete endpoints, which live on a different ESPN service. */
  webBaseUrl?: string;
  /** Host that serves a single news item by id. */
  contentBaseUrl?: string;
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
  private readonly contentBaseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly requestInit: (url: URL) => RequestInit;
  private readonly now: () => Date;

  constructor(options: EspnProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'https://site.api.espn.com').replace(/\/$/, '');
    this.webBaseUrl = (options.webBaseUrl ?? 'https://site.web.api.espn.com').replace(/\/$/, '');
    this.contentBaseUrl = (options.contentBaseUrl ?? 'https://content.core.api.espn.com').replace(
      TRAILING_SLASH,
      '',
    );
    this.fetchFn = options.fetch ?? ((...args) => globalThis.fetch(...args));
    const init = options.requestInit ?? {};
    this.requestInit = typeof init === 'function' ? init : () => init;
    this.now = options.now ?? (() => new Date());
  }

  private readonly inFlight = new Map<string, Promise<unknown>>();

  /**
   * One request per URL at a time: callers that ask for a URL already on its way share that
   * answer. A page and a background job often want the same table at the same moment, and
   * the mappers only read what they are given, so sharing the parsed body is safe.
   */
  private request<T>(
    path: string,
    params: Record<string, string | number | boolean> = {},
    base = this.baseUrl,
  ): Promise<T> {
    const url = new URL(`${base}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const key = url.toString();
    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const started = this.send<T>(url, path).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, started);
    return started;
  }

  private async send<T>(url: URL, path: string): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchFn(url, {
        ...this.requestInit(url),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      throw new ProviderError(`Network error calling ${path}`, undefined, { cause });
    }
    if (!res.ok) throw new ProviderError(`ESPN responded ${res.status} for ${path}`, res.status);
    return (await res.json()) as T;
  }

  private async scoreboard(slug: LeagueSlug, dates?: string): Promise<EspnScoreboard> {
    return this.request<EspnScoreboard>(
      `/apis/site/v2/sports/soccer/${codeOf(slug)}/scoreboard`,
      dates ? { dates, limit: 400 } : {},
    );
  }

  private europeanTeams: { ids: Set<string>; at: number } | undefined;

  /**
   * Ids of the European national teams. ESPN's friendlies feed is worldwide, and the Nations
   * League table is the one place that lists exactly the UEFA nations. Kept for six hours.
   * Returns null when the table cannot be read, in which case nothing is filtered out.
   */
  private async europeanTeamIds(): Promise<Set<string> | null> {
    const now = this.now().getTime();
    if (this.europeanTeams && now - this.europeanTeams.at < EUROPE_TTL_MS) {
      return this.europeanTeams.ids;
    }
    try {
      const table = await this.request<EspnStandings>(
        `/apis/v2/sports/soccer/${codeOf('nations-league')}/standings`,
      );
      const ids = new Set(mapStandings(table).map((row) => row.team.id));
      if (ids.size === 0) return null;
      this.europeanTeams = { ids, at: now };
      return ids;
    } catch {
      return this.europeanTeams?.ids ?? null;
    }
  }

  private async matchesFor(slug: LeagueSlug, dates: string): Promise<Match[]> {
    const [data, europe] = await Promise.all([
      this.scoreboard(slug, dates),
      slug === 'friendlies' ? this.europeanTeamIds() : Promise.resolve(null),
    ]);
    return (data.events ?? [])
      .map((e) => mapEvent(e, slug))
      .filter((m): m is Match => m !== null)
      .filter((m) => !europe || europe.has(m.homeTeam.id) || europe.has(m.awayTeam.id))
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }

  getLeagues(): Promise<League[]> {
    return Promise.resolve([...COVERED]);
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
      ...(league.teamCount ? { totalMatchdays: (league.teamCount - 1) * 2 } : {}),
    };
  }

  async getStandings(slug: LeagueSlug, options: StandingsOptions = {}): Promise<Standings> {
    if (!getLeague(slug).hasTable) {
      return {
        leagueSlug: slug,
        season: seasonLabel(this.now().getUTCFullYear()),
        updatedAt: this.now().toISOString(),
        rows: [],
      };
    }
    const now = this.now();
    const thisMonth = toIsoDate(now).slice(0, 7);
    const lastMonth = toIsoDate(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
    ).slice(0, 7);

    const [data, recent] = await Promise.all([
      this.request<EspnStandings>(`/apis/v2/sports/soccer/${codeOf(slug)}/standings`),
      // Form is not part of the standings feed; derive it from recent results. Best effort.
      options.includeForm === false
        ? Promise.resolve([] as Match[])
        : Promise.all([lastMonth, thisMonth].map((m) => this.matchesFor(slug, m.replace('-', ''))))
            .then((months) => months.flat())
            .catch(() => [] as Match[]),
    ]);

    const form = computeForm(recent);
    const groups = mapStandingsGroups(data).map((group) => ({
      name: group.name,
      rows: group.rows.map((row) => ({ ...row, form: form.get(row.team.id) ?? [] })),
    }));
    return {
      leagueSlug: slug,
      season: seasonLabel(data.season?.year ?? now.getUTCFullYear()),
      updatedAt: now.toISOString(),
      rows: groups.flatMap((group) => group.rows),
      ...(groups.length > 1 ? { groups } : {}),
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
    if (!getLeague(slug).hasScorers) return [];
    const data = await this.request<EspnStatistics>(
      `/apis/site/v2/sports/soccer/${codeOf(slug)}/statistics`,
    );
    // The statistics feed only carries full club names; the table has the short names.
    const table = await this.request<EspnStandings>(
      `/apis/v2/sports/soccer/${codeOf(slug)}/standings`,
    ).catch(() => null);
    const clubs = new Map((table ? mapStandings(table) : []).map((row) => [row.team.id, row.team]));
    return mapScorers(data, limit).map((s) => ({ ...s, team: clubs.get(s.team.id) ?? s.team }));
  }

  async getMatchesByDate(date: string): Promise<Match[]> {
    const dates = date.replaceAll('-', '');
    const all = await Promise.all(COVERED.map((l) => this.matchesFor(l.slug, dates)));
    return all.flat().sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }

  async getMatch(slug: LeagueSlug, matchId: string): Promise<MatchDetail> {
    getLeague(slug);
    checkId('match', matchId);
    const data = await this.request<EspnSummary>(
      `/apis/site/v2/sports/soccer/${codeOf(slug)}/summary`,
      { event: matchId },
    );
    const detail = mapMatchDetail(data, slug, matchId);
    if (!detail) throw new ProviderError(`ESPN has no match ${matchId} in ${slug}`, 404);
    return detail;
  }

  async getTeam(slug: LeagueSlug, teamId: string): Promise<TeamDetail> {
    getLeague(slug);
    checkId('team', teamId);
    const base = `/apis/site/v2/sports/soccer/${codeOf(slug)}/teams/${encodeURIComponent(teamId)}`;
    type TeamResponse = {
      team?: EspnTeam & { standingSummary?: string; franchise?: { venue?: { fullName?: string } } };
    };
    type Schedule = { events?: EspnEvent[] };
    type Roster = { athletes?: EspnRosterAthlete[] };

    // The team itself is required; the rest degrades to empty lists.
    const [info, played, upcoming, roster, feed] = await Promise.all([
      this.request<TeamResponse>(base),
      this.request<Schedule>(`${base}/schedule`).catch(() => ({}) as Schedule),
      this.request<Schedule>(`${base}/schedule`, { fixture: true }).catch(() => ({}) as Schedule),
      this.request<Roster>(`${base}/roster`).catch(() => ({}) as Roster),
      this.request<EspnNewsFeed>(`/apis/site/v2/sports/soccer/${codeOf(slug)}/news`, {
        team: teamId,
        limit: TEAM_NEWS_FETCH,
      }).catch(() => ({}) as EspnNewsFeed),
    ]);
    if (!info.team) throw new ProviderError(`ESPN has no team ${teamId} in ${slug}`, 404);

    const toMatches = (schedule: Schedule) =>
      (schedule.events ?? []).map((e) => mapEvent(e, slug)).filter((m): m is Match => m !== null);
    const venue = info.team.franchise?.venue?.fullName;
    const news = mergeNews(
      [
        (feed.articles ?? [])
          .map((item) => mapNewsItem(item, slug) ?? null)
          .filter((a): a is NewsArticle => a !== null),
      ],
      TEAM_NEWS_LIMIT,
    );

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
      ...(news.length > 0 ? { news } : {}),
    };
  }

  async getPlayer(slug: LeagueSlug, playerId: string): Promise<PlayerDetail> {
    getLeague(slug);
    checkId('player', playerId);
    const base = `/apis/common/v3/sports/soccer/${codeOf(slug)}/athletes/${encodeURIComponent(playerId)}`;
    const [profile, log] = await Promise.all([
      this.request<EspnAthleteProfile>(base, {}, this.webBaseUrl),
      this.request<EspnGameLog>(`${base}/gamelog`, {}, this.webBaseUrl).catch(() => null),
    ]);
    const detail = mapPlayerDetail(profile, log, slug);
    if (!detail) throw new ProviderError(`ESPN has no player ${playerId} in ${slug}`, 404);
    return detail;
  }

  async getNews(leagues: readonly LeagueSlug[], limit = 8): Promise<NewsArticle[]> {
    // One feed per competition. Cap the fan-out: a whole category can be a dozen leagues.
    // Leagues ESPN does not cover have no feed here; asking only for those yields nothing.
    const covered = leagues.filter((slug) => ESPN_CODES[slug] !== undefined);
    if (leagues.length > 0 && covered.length === 0) return [];
    const slugs = covered.length > 0 ? covered.slice(0, MAX_NEWS_FEEDS) : DEFAULT_NEWS_FEEDS;
    const lists = await Promise.all(
      slugs.map((slug) =>
        this.request<EspnNewsFeed>(`/apis/site/v2/sports/soccer/${codeOf(slug)}/news`, {
          // Video clips are dropped after fetching, so ask for more than we need.
          limit: Math.min(50, limit * 3),
        })
          .then((feed) =>
            (feed.articles ?? [])
              .map((item) => mapNewsItem(item, slugs.length === 1 ? slug : undefined) ?? null)
              .filter((a): a is NewsArticle => a !== null)
              // In a merged list, a story filed under several leagues keeps the feed it came from
              // only when its own categories do not already name a competition.
              .map((a) => (a.leagueSlug ? a : { ...a, leagueSlug: slug })),
          )
          // One dead feed must not blank the whole list.
          .catch(() => [] as NewsArticle[]),
      ),
    );
    return mergeNews(lists, limit);
  }

  async getArticle(articleId: string): Promise<NewsArticle> {
    checkId('article', articleId);
    const data = await this.request<EspnNewsHeadlines>(
      `/v1/sports/news/${articleId}`,
      {},
      this.contentBaseUrl,
    );
    const article = data.headlines?.[0] ? mapNewsItem(data.headlines[0]) : null;
    if (!article) throw new ProviderError(`ESPN has no article ${articleId}`, 404);
    return article;
  }
}
