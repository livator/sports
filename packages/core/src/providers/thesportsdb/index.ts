import { LEAGUES, getLeague } from '../../leagues';
import { computeForm, computeStandings } from '../../standings';
import type {
  League,
  LeagueSlug,
  Match,
  MatchDetail,
  PastMeeting,
  Scorer,
  Season,
  Standings,
  TeamDetail,
} from '../../types';
import { ProviderError, type MatchQuery, type SportsDataProvider } from '../types';
import {
  mapEvent,
  mapEvents,
  mapTeam,
  seasonLabel,
  teamsIn,
  toTheirId,
  type TsdbEvents,
  type TsdbTeam,
} from './mappers';

/**
 * The leagues this source serves, with its ids for them. `regularRounds` is the length of the
 * regular season: the table is computed from results, and Romania and Moldova follow it with
 * a play-off phase whose points rules (halved, or reset) a plain sum would get wrong. After
 * the regular season the table therefore stays the regular-season table.
 */
const TSDB_LEAGUES: Partial<Record<LeagueSlug, { id: string; regularRounds: number }>> = {
  'romanian-superliga': { id: '4691', regularRounds: 30 },
  'moldovan-super-liga': { id: '4655', regularRounds: 14 },
  'ukrainian-premier-league': { id: '4354', regularRounds: 30 },
};
const COVERED = LEAGUES.filter((l) => TSDB_LEAGUES[l.slug] !== undefined);

/** The public test key. It works without signing up, within the limits described below. */
const FREE_KEY = '123';

/** How quickly an answer goes out of date, which decides how long it may be reused. */
export type Freshness = 'live' | 'recent' | 'settled' | 'static';
const REUSE_MS: Record<Freshness, number> = {
  live: 45_000,
  recent: 15 * 60_000,
  settled: 12 * 60 * 60_000,
  static: 24 * 60 * 60_000,
};
/**
 * How long past its reuse time an answer may still be handed out while a new one is fetched
 * in the background. Within this, nobody waits for the source; beyond it, the caller does.
 */
const STALE_OK_MS: Record<Freshness, number> = {
  live: 10 * 60_000,
  recent: 6 * 60 * 60_000,
  settled: 7 * 24 * 60 * 60_000,
  static: 30 * 24 * 60 * 60_000,
};

/** One remembered answer. */
export interface TheSportsDbEntry {
  /** Reusable as it is until this time (epoch ms). */
  until: number;
  value: unknown;
}

/**
 * Somewhere to keep answers between restarts. Without one, every restart begins with an
 * empty memory and spends a couple of minutes of request budget rebuilding the tables.
 * Keys contain the API key, so an implementation should not store them in the clear.
 */
export interface TheSportsDbStore {
  read(key: string): Promise<TheSportsDbEntry | undefined>;
  write(key: string, entry: TheSportsDbEntry): Promise<void>;
}

/**
 * The free key is documented at 30 requests a minute, and a refusal is slow to clear. So the
 * provider keeps its own count and stays under, instead of finding the limit by hitting it.
 */
const FREE_BUDGET = { requests: 26, perMs: 60_000 };
const PAID_BUDGET = { requests: 90, perMs: 60_000 };
const MAX_CONCURRENT = 2;
const RETRY_WAITS_MS = [4_000, 10_000];
/** Rounds either side of the current one that date queries look at. */
const DAY_WINDOW = 1;
const RANGE_WINDOW = 4;
const FIXTURES_AHEAD = 3;
/** A round counts as busy from a little before a kick-off until the result has settled. */
const BUSY_BEFORE_MS = 30 * 60_000;
const BUSY_AFTER_MS = 3 * 60 * 60_000;
/** No single request may outlive this; see the same constant in the ESPN provider. */
const REQUEST_TIMEOUT_MS = 10_000;
/** How long a caller waits before being told to come back. The work carries on regardless. */
const PATIENCE_MS = 8_000;

export interface TheSportsDbProviderOptions {
  /** A Patreon key raises the rate limit. Without one the public test key is used. */
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /**
   * Extra request options. Do not put another cache in front of this provider: it would hide
   * requests from the budget and refresh on its own schedule. In Next.js pass `cache: 'no-store'`.
   */
  requestInit?: (url: URL, freshness: Freshness) => RequestInit;
  /** Keeps answers between restarts. */
  store?: TheSportsDbStore;
  now?: () => Date;
  /** Requests allowed per window. Injectable so tests need not wait a minute. */
  budget?: { requests: number; perMs: number };
  /** Waits between retries after "too many requests". */
  retryWaitsMs?: readonly number[];
  /** Pause, injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** How long a call may take before it fails with a 503. Defaults to eight seconds. */
  patienceMs?: number;
}

/**
 * Adapter for TheSportsDB (v1 JSON API), used for the leagues ESPN has no current data for.
 *
 * The free key truncates season lists and league tables (five rows), but returns every match
 * of a single round. So everything here is built from rounds: the table is computed from
 * results, and date queries look at the rounds around the current one.
 *
 * Requests are the scarce resource. A table is a dozen of them, so answers are kept in memory
 * for as long as their freshness allows, identical requests are shared, and the provider
 * paces itself under the source's limit. The first table after a cold start can therefore
 * take a while; after that everything is served from what is already known.
 *
 * The source has no goalscorers, line-ups, match statistics, squads or scorer lists for
 * these leagues, so those parts of the app stay empty for them.
 */
export class TheSportsDbProvider implements SportsDataProvider {
  readonly name = 'thesportsdb';
  private readonly base: string;
  private readonly fetchFn: typeof fetch;
  private readonly requestInit: (url: URL, freshness: Freshness) => RequestInit;
  private readonly now: () => Date;
  private readonly budget: { requests: number; perMs: number };
  private readonly retryWaits: readonly number[];
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly patienceMs: number;

  private readonly store: TheSportsDbStore | undefined;
  private readonly kept = new Map<string, TheSportsDbEntry>();
  private readonly recalling = new Map<string, Promise<TheSportsDbEntry | undefined>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  /** When each recent request to the source went out, oldest first. */
  private readonly sentAt: number[] = [];
  private running = 0;
  private readonly waiting: Array<() => void> = [];
  /** Every match seen so far, by league and round. Lets a date query find a replayed game. */
  private readonly seen = new Map<LeagueSlug, Map<number, Match[]>>();

  constructor(options: TheSportsDbProviderOptions = {}) {
    const root = (options.baseUrl ?? 'https://www.thesportsdb.com/api/v1/json').replace(/\/$/, '');
    const key = options.apiKey?.trim();
    this.base = `${root}/${encodeURIComponent(key || FREE_KEY)}`;
    this.fetchFn = options.fetch ?? ((...args) => globalThis.fetch(...args));
    this.requestInit = options.requestInit ?? (() => ({}));
    this.now = options.now ?? (() => new Date());
    this.budget = options.budget ?? (key ? PAID_BUDGET : FREE_BUDGET);
    this.retryWaits = options.retryWaitsMs ?? RETRY_WAITS_MS;
    this.sleep = options.sleep ?? ((ms) => new Promise((resume) => setTimeout(resume, ms)));
    this.patienceMs = options.patienceMs ?? PATIENCE_MS;
    this.store = options.store;
  }

  /**
   * Gives up on behalf of the caller after a while, without cancelling anything: a cold table
   * can take a minute under the free key's budget, and nobody should watch a blank page for
   * that long. The requests keep going and their answers are kept, so asking again soon
   * after succeeds at once.
   */
  private patient<T>(work: Promise<T>, what: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const gaveUp = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new ProviderError(`TheSportsDB is still loading ${what}`, 503)),
        this.patienceMs,
      );
    });
    return Promise.race([work, gaveUp]).finally(() => clearTimeout(timer));
  }

  /* ---------- Transport ---------- */

  private async slot<T>(work: () => Promise<T>): Promise<T> {
    if (this.running >= MAX_CONCURRENT) await new Promise<void>((go) => this.waiting.push(go));
    this.running++;
    try {
      return await work();
    } finally {
      this.running--;
      this.waiting.shift()?.();
    }
  }

  /** Waits until another request fits in the budget, then books it. */
  private async book(): Promise<void> {
    for (;;) {
      const now = Date.now();
      while (this.sentAt.length > 0 && now - (this.sentAt[0] ?? 0) >= this.budget.perMs) {
        this.sentAt.shift();
      }
      if (this.sentAt.length < this.budget.requests) {
        this.sentAt.push(now);
        return;
      }
      await this.sleep(Math.max(50, this.budget.perMs - (now - (this.sentAt[0] ?? now))));
    }
  }

  /** What is remembered for a key: memory first, then the store, read once per key. */
  private recall(key: string): Promise<TheSportsDbEntry | undefined> {
    const known = this.kept.get(key);
    if (known || !this.store) return Promise.resolve(known);
    let reading = this.recalling.get(key);
    if (!reading) {
      reading = this.store
        .read(key)
        .catch(() => undefined)
        .then((entry) => {
          if (entry && !this.kept.has(key)) this.kept.set(key, entry);
          this.recalling.delete(key);
          return this.kept.get(key);
        });
      this.recalling.set(key, reading);
    }
    return reading;
  }

  private refresh<T>(
    key: string,
    url: URL,
    path: string,
    freshness: Freshness,
    reuseAs?: (value: T) => Freshness,
  ): Promise<T> {
    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;
    const started = this.slot(() => this.send<T>(url, path, freshness))
      .then((value) => {
        const reuse = REUSE_MS[reuseAs ? reuseAs(value) : freshness];
        const entry = { until: this.now().getTime() + reuse, value };
        this.kept.set(key, entry);
        void this.store?.write(key, entry).catch(() => undefined);
        return value;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, started);
    return started;
  }

  /**
   * An answer that is still good is returned as it is. One that is a little out of date is
   * returned too, while a new one is fetched behind the caller's back: with a request budget
   * this tight, making people wait for every refresh is what turns a page into a minute.
   */
  private async request<T>(
    path: string,
    params: Record<string, string | number>,
    freshness: Freshness,
    /** Looks at the answer and may say it can be reused for longer than `freshness` assumed. */
    reuseAs?: (value: T) => Freshness,
  ): Promise<T> {
    const url = new URL(`${this.base}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const key = url.toString();

    const entry = await this.recall(key);
    const now = this.now().getTime();
    if (entry && entry.until > now) return entry.value as T;

    const fresh = this.refresh(key, url, path, freshness, reuseAs);
    if (entry && now - entry.until < STALE_OK_MS[freshness]) {
      fresh.catch(() => undefined);
      return entry.value as T;
    }
    return fresh;
  }

  private async send<T>(url: URL, path: string, freshness: Freshness): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await this.book();
      let res: Response;
      try {
        res = await this.fetchFn(url, {
          ...this.requestInit(url, freshness),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (cause) {
        throw new ProviderError(`Network error calling ${path}`, undefined, { cause });
      }
      const wait = this.retryWaits[attempt];
      if (res.status === 429 && wait !== undefined) {
        await this.sleep(wait);
        continue;
      }
      if (!res.ok) {
        throw new ProviderError(`TheSportsDB responded ${res.status} for ${path}`, res.status);
      }
      return (await res.json()) as T;
    }
  }

  /* ---------- Building blocks ---------- */

  private config(slug: LeagueSlug) {
    const config = TSDB_LEAGUES[slug];
    if (!config) throw new ProviderError(`TheSportsDB is not used for ${slug}`, 404);
    return config;
  }

  /**
   * Where the league is: the round being played (or next up), the last one with a result,
   * and the season, which is printed on every match and so needs no request of its own.
   */
  private async rounds(
    slug: LeagueSlug,
  ): Promise<{ current: number; lastPlayed: number; season: string }> {
    const { id } = this.config(slug);
    const [next, last] = await Promise.all([
      this.request<TsdbEvents>('/eventsnextleague.php', { id }, 'recent').catch(() => null),
      this.request<TsdbEvents>('/eventspastleague.php', { id }, 'recent').catch(() => null),
    ]);
    if (!next && !last) throw new ProviderError(`TheSportsDB cannot say where ${slug} is`, 502);
    const round = (data: TsdbEvents | null) =>
      Number.parseInt(data?.events?.[0]?.intRound ?? '', 10) || 0;
    const season = next?.events?.[0]?.strSeason ?? last?.events?.[0]?.strSeason;
    if (!season) throw new ProviderError(`TheSportsDB has no season for ${slug}`, 404);
    const lastPlayed = round(last);
    const current = Math.max(round(next), lastPlayed, 1);
    return { current, lastPlayed: lastPlayed || current, season };
  }

  private async round(slug: LeagueSlug, r: number, current: number): Promise<Match[]> {
    // Old rounds hardly change; the current one and the one before it may be live or just over.
    const freshness: Freshness = r < current - 1 ? 'settled' : r > current ? 'recent' : 'live';
    const data = await this.request<TsdbEvents>(
      '/eventsround.php',
      { id: this.config(slug).id, r, s: (await this.rounds(slug)).season },
      freshness,
      // "Live" is the cautious guess made before looking. If nothing in the round is being
      // played or is about to be, it can wait a quarter of an hour like any other round,
      // which saves most of the requests on a day without football.
      (answer) =>
        freshness === 'live' && !this.isBusy(mapEvents(answer, slug)) ? 'recent' : freshness,
    );
    const matches = mapEvents(data, slug);
    const rounds = this.seen.get(slug) ?? new Map<number, Match[]>();
    rounds.set(r, matches);
    this.seen.set(slug, rounds);
    return matches;
  }

  /** Is anything in these matches live, or kicking off or finishing around now? */
  private isBusy(matches: readonly Match[]): boolean {
    const now = this.now().getTime();
    return matches.some((m) => {
      if (m.status === 'live' || m.status === 'paused') return true;
      const kickoff = new Date(m.kickoff).getTime();
      return kickoff - now < BUSY_BEFORE_MS && now - kickoff < BUSY_AFTER_MS;
    });
  }

  /**
   * Several rounds at once. `strict` is for the table: a table built from the rounds that
   * happened to load is a wrong table, so one missing round fails the lot. Fixture lists and
   * day views are better off with what there is.
   */
  private async roundsBetween(
    slug: LeagueSlug,
    from: number,
    to: number,
    current: number,
    strict = false,
  ): Promise<Match[]> {
    const numbers = [];
    for (let r = Math.max(1, from); r <= to; r++) numbers.push(r);
    const lists = await Promise.all(
      numbers.map((r) =>
        strict ? this.round(slug, r, current) : this.round(slug, r, current).catch(() => []),
      ),
    );
    return lists.flat();
  }

  /** Everything played so far in the regular season, which is what the table is made of. */
  private async regularSeason(slug: LeagueSlug): Promise<Match[]> {
    const { current, lastPlayed } = await this.rounds(slug);
    const upTo = Math.min(Math.max(current, lastPlayed), this.config(slug).regularRounds);
    return this.roundsBetween(slug, 1, upTo, current, true);
  }

  /* ---------- SportsDataProvider ---------- */

  getLeagues(): Promise<League[]> {
    return Promise.resolve([...COVERED]);
  }

  getSeason(slug: LeagueSlug): Promise<Season> {
    return this.patient(this.getSeasonNow(slug), `the ${slug} season`);
  }

  private async getSeasonNow(slug: LeagueSlug): Promise<Season> {
    getLeague(slug);
    const { current, season } = await this.rounds(slug);
    const [from, to] = season.split('-');
    return {
      label: seasonLabel(season),
      startDate: `${from}-07-01`,
      endDate: `${to ?? from}-06-30`,
      currentMatchday: current,
    };
  }

  getStandings(slug: LeagueSlug): Promise<Standings> {
    return this.patient(this.getStandingsNow(slug), `the ${slug} table`);
  }

  private async getStandingsNow(slug: LeagueSlug): Promise<Standings> {
    getLeague(slug);
    const [{ season }, matches] = await Promise.all([this.rounds(slug), this.regularSeason(slug)]);
    if (matches.length === 0)
      throw new ProviderError(`TheSportsDB has no matches for ${slug}`, 502);
    return {
      leagueSlug: slug,
      season: seasonLabel(season),
      updatedAt: this.now().toISOString(),
      // Clubs come from the fixture list, so one that has not played yet still gets a row.
      rows: computeStandings(teamsIn(matches), matches),
    };
  }

  getMatches(slug: LeagueSlug, query: MatchQuery = {}): Promise<Match[]> {
    return this.patient(this.getMatchesNow(slug, query), `${slug} fixtures`);
  }

  private async getMatchesNow(slug: LeagueSlug, query: MatchQuery): Promise<Match[]> {
    getLeague(slug);
    const { current } = await this.rounds(slug);
    const matches =
      query.matchday !== undefined
        ? await this.round(slug, query.matchday, current)
        : await this.roundsBetween(slug, current - RANGE_WINDOW, current + RANGE_WINDOW, current);
    return matches
      .filter((m) => {
        const day = m.kickoff.slice(0, 10);
        return (!query.dateFrom || day >= query.dateFrom) && (!query.dateTo || day <= query.dateTo);
      })
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }

  getTopScorers(): Promise<Scorer[]> {
    return Promise.resolve([]);
  }

  private async matchesOn(slug: LeagueSlug, date: string): Promise<Match[]> {
    const { current } = await this.rounds(slug);
    const nearby = await this.roundsBetween(
      slug,
      current - DAY_WINDOW,
      current + DAY_WINDOW,
      current,
    );
    const days = nearby.map((m) => m.kickoff.slice(0, 10)).sort();
    const covered = days.length > 0 && date >= (days[0] ?? '') && date <= (days.at(-1) ?? '');

    // A day far from now is not in the rounds around today, so it costs one more request.
    // The free key may cut that list short, which is why it is the fallback and not the rule.
    const today = this.now().toISOString().slice(0, 10);
    const thatDay = covered
      ? []
      : await this.request<TsdbEvents>(
          '/eventsday.php',
          { d: date, l: this.config(slug).id },
          date < today ? 'settled' : 'recent',
        )
          .then((data) => mapEvents(data, slug))
          .catch(() => [] as Match[]);

    // Rounds already read for the table cost nothing to look through, and that is where a
    // postponed game turns up when it is finally played.
    const known = [...(this.seen.get(slug)?.values() ?? [])].flat();
    const byId = new Map<string, Match>();
    for (const m of [...known, ...thatDay, ...nearby]) {
      if (m.kickoff.slice(0, 10) === date) byId.set(m.id, m);
    }
    return [...byId.values()];
  }

  async getMatchesByDate(date: string): Promise<Match[]> {
    // A league that cannot be read today should not hide the others.
    const lists = await Promise.all(
      COVERED.map((l) => this.matchesOn(l.slug, date).catch(() => [] as Match[])),
    );
    return lists.flat().sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }

  getMatch(slug: LeagueSlug, matchId: string): Promise<MatchDetail> {
    return this.patient(this.getMatchNow(slug, matchId), `match ${matchId}`);
  }

  private async getMatchNow(slug: LeagueSlug, matchId: string): Promise<MatchDetail> {
    getLeague(slug);
    const id = toTheirId(matchId);
    const data = id ? await this.request<TsdbEvents>('/lookupevent.php', { id }, 'live') : null;
    const event = data?.events?.[0];
    const match = event ? mapEvent(event, slug) : null;
    if (!match) throw new ProviderError(`TheSportsDB has no match ${matchId} in ${slug}`, 404);

    // The source has no timeline, line-ups or statistics for these leagues. Form and this
    // season's meetings can still be worked out from the results.
    const played = (await this.regularSeason(slug).catch(() => [] as Match[])).filter(
      (m) => m.status === 'finished' && m.id !== match.id,
    );
    const before = computeForm(played.filter((m) => m.kickoff < match.kickoff));
    const pair = new Set([match.homeTeam.id, match.awayTeam.id]);
    const meetings: PastMeeting[] = played
      .filter((m) => pair.has(m.homeTeam.id) && pair.has(m.awayTeam.id))
      .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
      .map((m) => ({
        id: m.id,
        date: m.kickoff,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        score: m.score,
      }));
    const form = {
      home: before.get(match.homeTeam.id) ?? [],
      away: before.get(match.awayTeam.id) ?? [],
    };

    return {
      match,
      stats: [],
      timeline: [],
      headToHead: { meetings },
      ...(form.home.length > 0 || form.away.length > 0 ? { form } : {}),
    };
  }

  getTeam(slug: LeagueSlug, teamId: string): Promise<TeamDetail> {
    return this.patient(this.getTeamNow(slug, teamId), `team ${teamId}`);
  }

  private async getTeamNow(slug: LeagueSlug, teamId: string): Promise<TeamDetail> {
    getLeague(slug);
    const id = toTheirId(teamId);
    const data = id
      ? await this.request<{ teams?: TsdbTeam[] | null }>('/lookupteam.php', { id }, 'static')
      : null;
    const team = data?.teams?.[0];
    if (!team) throw new ProviderError(`TheSportsDB has no team ${teamId} in ${slug}`, 404);

    const { current } = await this.rounds(slug);
    const all = await this.roundsBetween(slug, 1, current + FIXTURES_AHEAD, current);
    const theirs = all.filter((m) => m.homeTeam.id === teamId || m.awayTeam.id === teamId);
    const open = (m: Match) => m.status === 'scheduled' || m.status === 'postponed';

    return {
      team: mapTeam(team.idTeam, team.strTeam, team.strBadge),
      leagueSlug: slug,
      ...(team.strStadium ? { venue: team.strStadium } : {}),
      results: theirs.filter((m) => !open(m)).sort((a, b) => b.kickoff.localeCompare(a.kickoff)),
      fixtures: theirs.filter(open).sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
      squad: [],
    };
  }
}
