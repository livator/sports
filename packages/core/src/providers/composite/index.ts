import { LEAGUES } from '../../leagues';
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
import {
  ProviderError,
  type MatchQuery,
  type SportsDataProvider,
  type StandingsOptions,
} from '../types';

/**
 * Several data sources behind one provider. Each league is served by the first source that
 * lists it in `getLeagues()`, so the order of the sources is the order of preference. The
 * rest of the app keeps talking to a single `SportsDataProvider` and never learns that
 * Romania comes from somewhere else than England.
 */
export class CompositeProvider implements SportsDataProvider {
  /** The main source's name, so checks such as "is this demo data?" keep working. */
  readonly name: string;
  /** Every source in use, for crediting them. */
  readonly sources: readonly string[];
  private routes: Promise<Map<LeagueSlug, SportsDataProvider>> | undefined;

  constructor(
    private readonly providers: readonly SportsDataProvider[],
    /** How long the day's scoreboard waits for a source other than the main one. */
    private readonly secondaryPatienceMs = 1_200,
  ) {
    const [main] = providers;
    if (!main) throw new Error('CompositeProvider needs at least one provider');
    this.name = main.name;
    this.sources = providers.map((p) => p.name);
  }

  private routing(): Promise<Map<LeagueSlug, SportsDataProvider>> {
    this.routes ??= Promise.all(
      this.providers.map(async (p) => ({ p, leagues: await p.getLeagues() })),
    )
      .then((lists) => {
        const routes = new Map<LeagueSlug, SportsDataProvider>();
        for (const { p, leagues } of lists) {
          for (const league of leagues) if (!routes.has(league.slug)) routes.set(league.slug, p);
        }
        return routes;
      })
      .catch((error: unknown) => {
        this.routes = undefined;
        throw error;
      });
    return this.routes;
  }

  private async providerFor(slug: LeagueSlug): Promise<SportsDataProvider> {
    const provider = (await this.routing()).get(slug);
    if (!provider) throw new ProviderError(`No data source covers ${slug}`, 404);
    return provider;
  }

  async getLeagues(): Promise<League[]> {
    const routes = await this.routing();
    // The app's own display order, whatever order the sources answered in.
    return LEAGUES.filter((l) => routes.has(l.slug));
  }

  async getSeason(slug: LeagueSlug): Promise<Season> {
    return (await this.providerFor(slug)).getSeason(slug);
  }

  async getStandings(slug: LeagueSlug, options?: StandingsOptions): Promise<Standings> {
    return (await this.providerFor(slug)).getStandings(slug, options);
  }

  async getMatches(slug: LeagueSlug, query?: MatchQuery): Promise<Match[]> {
    return (await this.providerFor(slug)).getMatches(slug, query);
  }

  async getTopScorers(slug: LeagueSlug, limit?: number): Promise<Scorer[]> {
    return (await this.providerFor(slug)).getTopScorers(slug, limit);
  }

  async getMatchesByDate(date: string): Promise<Match[]> {
    const routes = await this.routing();
    // The scoreboard is the front page. A slow secondary source must not hold it up: past a
    // short wait its leagues are left out of this answer, and turn up on the next one.
    const inTime = (work: Promise<Match[]>) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<Match[]>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new ProviderError('Too slow', 504)),
          this.secondaryPatienceMs,
        );
      });
      return Promise.race([work, late]).finally(() => clearTimeout(timer));
    };
    const results = await Promise.allSettled(
      this.providers.map((p, i) =>
        i === 0 ? p.getMatchesByDate(date) : inTime(p.getMatchesByDate(date)),
      ),
    );
    // The day is only lost if the main source fails. A secondary one failing costs its leagues.
    const [main] = results;
    if (main?.status === 'rejected') throw main.reason;
    return results
      .flatMap((result, i) =>
        result.status === 'fulfilled'
          ? result.value.filter((m) => routes.get(m.leagueSlug) === this.providers[i])
          : [],
      )
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }

  async getMatch(slug: LeagueSlug, matchId: string): Promise<MatchDetail> {
    const provider = await this.providerFor(slug);
    if (!provider.getMatch) throw new ProviderError(`${provider.name} has no match pages`, 501);
    return provider.getMatch(slug, matchId);
  }

  async getTeam(slug: LeagueSlug, teamId: string): Promise<TeamDetail> {
    const provider = await this.providerFor(slug);
    if (!provider.getTeam) throw new ProviderError(`${provider.name} has no team pages`, 501);
    return provider.getTeam(slug, teamId);
  }

  async getPlayer(slug: LeagueSlug, playerId: string): Promise<PlayerDetail> {
    const provider = await this.providerFor(slug);
    if (!provider.getPlayer) throw new ProviderError(`${provider.name} has no player pages`, 501);
    return provider.getPlayer(slug, playerId);
  }

  async getNews(leagues: readonly LeagueSlug[], limit = 8): Promise<NewsArticle[]> {
    const routes = await this.routing();
    const lists = await Promise.all(
      this.providers
        .filter((p) => p.getNews)
        .map((p) => {
          const mine = leagues.filter((slug) => routes.get(slug) === p);
          // No filter means "the general mix": every source with news contributes. With a
          // filter, a source is only asked about leagues that are its own.
          if (leagues.length > 0 && mine.length === 0) return [] as NewsArticle[];
          return p.getNews!(mine, limit).catch(() => [] as NewsArticle[]);
        }),
    );
    return lists
      .flat()
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, limit);
  }

  async getArticle(articleId: string): Promise<NewsArticle> {
    let last: unknown = new ProviderError('No data source has news', 501);
    for (const provider of this.providers) {
      if (!provider.getArticle) continue;
      try {
        return await provider.getArticle(articleId);
      } catch (error) {
        last = error;
      }
    }
    throw last;
  }
}
