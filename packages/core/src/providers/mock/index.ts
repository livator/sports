import { LEAGUES, getLeague } from '../../leagues';
import { computeStandings } from '../../standings';
import type { League, LeagueSlug, Match, Scorer, Season, Standings } from '../../types';
import { ProviderError, type MatchQuery, type SportsDataProvider } from '../types';
import { simulateScorers, simulateSeason, type SimulatedSeason } from './season';
import { SEED_TEAMS, type SeedTeam } from './teams';

/** The competitions this provider can simulate. */
const SEEDED = LEAGUES.filter((l) => SEED_TEAMS[l.slug]);

function seedTeams(slug: LeagueSlug): readonly SeedTeam[] {
  const teams = SEED_TEAMS[slug];
  if (!teams) throw new ProviderError(`The demo provider does not simulate ${slug}`, 404);
  return teams;
}

export interface MockProviderOptions {
  /** Clock used to decide which matches are finished/live. Defaults to `() => new Date()`. */
  now?: () => Date;
  /** First matchday date (UTC). Defaults to mid-August of the current season. */
  seasonStart?: Date;
  /** Simulated network latency in ms (useful for testing loading states). */
  latencyMs?: number;
}

function defaultSeasonStart(now: Date): Date {
  // Seasons run August -> May; before August we are still in last year's season.
  const year = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(year, 7, 14));
}

/**
 * Deterministic in-memory provider. Same inputs always produce the same season,
 * which makes it perfect for local development, demos, tests and Storybook.
 */
export class MockProvider implements SportsDataProvider {
  readonly name = 'mock';
  private readonly now: () => Date;
  private readonly seasonStart: Date | undefined;
  private readonly latencyMs: number;
  private cache = new Map<string, SimulatedSeason>();

  constructor(options: MockProviderOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.seasonStart = options.seasonStart;
    this.latencyMs = options.latencyMs ?? 0;
  }

  private async delay<T>(value: T): Promise<T> {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs));
    return value;
  }

  private season(slug: LeagueSlug): SimulatedSeason {
    const now = this.now();
    // cache key includes the minute so live matches tick without recomputing on every call
    const key = `${slug}:${Math.floor(now.getTime() / 60_000)}`;
    let season = this.cache.get(key);
    if (!season) {
      this.cache.clear();
      season = simulateSeason(
        slug,
        seedTeams(slug),
        this.seasonStart ?? defaultSeasonStart(now),
        now,
      );
      this.cache.set(key, season);
    }
    return season;
  }

  getLeagues(): Promise<League[]> {
    return this.delay([...SEEDED]);
  }

  getSeason(slug: LeagueSlug): Promise<Season> {
    const season = this.season(slug);
    const nowIso = this.now().toISOString();
    const upcoming = season.matches.find((m) => m.kickoff >= nowIso && m.status === 'scheduled');
    const live = season.matches.find((m) => m.status === 'live' || m.status === 'paused');
    const currentMatchday = live?.matchday ?? upcoming?.matchday ?? season.totalMatchdays;
    return this.delay({
      label: season.label,
      startDate: season.startDate,
      endDate: season.endDate,
      currentMatchday,
      totalMatchdays: season.totalMatchdays,
    });
  }

  getStandings(slug: LeagueSlug): Promise<Standings> {
    getLeague(slug);
    const season = this.season(slug);
    const teams = seedTeams(slug).map(({ strength: _s, ...team }) => team);
    return this.delay({
      leagueSlug: slug,
      season: season.label,
      updatedAt: this.now().toISOString(),
      rows: computeStandings(teams, season.matches),
    });
  }

  getMatches(slug: LeagueSlug, query: MatchQuery = {}): Promise<Match[]> {
    const { matches } = this.season(slug);
    return this.delay(
      matches.filter((m) => {
        if (query.matchday !== undefined && m.matchday !== query.matchday) return false;
        const date = m.kickoff.slice(0, 10);
        if (query.dateFrom && date < query.dateFrom) return false;
        if (query.dateTo && date > query.dateTo) return false;
        return true;
      }),
    );
  }

  getTopScorers(slug: LeagueSlug, limit = 10): Promise<Scorer[]> {
    const { matches } = this.season(slug);
    const scorers = simulateScorers(slug, seedTeams(slug), matches)
      .slice(0, limit)
      .map((s, i) => ({ rank: i + 1, ...s }));
    return this.delay(scorers);
  }

  async getMatchesByDate(date: string): Promise<Match[]> {
    const all = await Promise.all(
      SEEDED.map((l) => this.getMatches(l.slug, { dateFrom: date, dateTo: date })),
    );
    return all.flat().sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }
}
