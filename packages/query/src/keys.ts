import type { LeagueSlug, MatchQuery } from '@sports/core';

/** Centralised query keys so web and mobile invalidate the same cache entries. */
export const sportsKeys = {
  all: ['sports'] as const,
  leagues: () => [...sportsKeys.all, 'leagues'] as const,
  league: (slug: LeagueSlug) => [...sportsKeys.all, 'league', slug] as const,
  season: (slug: LeagueSlug) => [...sportsKeys.league(slug), 'season'] as const,
  standings: (slug: LeagueSlug) => [...sportsKeys.league(slug), 'standings'] as const,
  matches: (slug: LeagueSlug, query: MatchQuery = {}) =>
    [...sportsKeys.league(slug), 'matches', query] as const,
  scorers: (slug: LeagueSlug, limit: number) =>
    [...sportsKeys.league(slug), 'scorers', limit] as const,
  match: (slug: LeagueSlug, id: string) => [...sportsKeys.league(slug), 'match', id] as const,
  team: (slug: LeagueSlug, id: string) => [...sportsKeys.league(slug), 'team', id] as const,
  player: (slug: LeagueSlug, id: string) => [...sportsKeys.league(slug), 'player', id] as const,
  news: (leagues: readonly LeagueSlug[], limit: number) =>
    [...sportsKeys.all, 'news', [...leagues].sort().join(','), limit] as const,
  article: (id: string) => [...sportsKeys.all, 'article', id] as const,
  matchesByDate: (date: string) => [...sportsKeys.all, 'matches-by-date', date] as const,
};
