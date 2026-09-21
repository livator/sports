'use client';

import type { LeagueSlug, Match, MatchQuery, StandingsOptions } from '@sports/core';
import { isLive } from '@sports/core';
import { useQuery } from '@tanstack/react-query';
import { sportsKeys } from './keys';
import { useSportsData } from './provider';

const LIVE_REFETCH_MS = 30_000;
const PRE_MATCH_REFETCH_MS = 60_000;
const PRE_MATCH_WINDOW_MS = 2 * 60 * 60_000;

/**
 * Poll quickly while something is live, slowly when a kick-off is close
 * (so a scheduled match flips to live on its own), and not at all otherwise.
 */
function matchRefetchInterval(matches: Match[] | undefined): number | false {
  if (!matches) return false;
  if (matches.some((m) => isLive(m.status))) return LIVE_REFETCH_MS;
  const now = Date.now();
  const kickOffSoon = matches.some(
    (m) => m.status === 'scheduled' && new Date(m.kickoff).getTime() - now < PRE_MATCH_WINDOW_MS,
  );
  return kickOffSoon ? PRE_MATCH_REFETCH_MS : false;
}

export function useLeagues() {
  const provider = useSportsData();
  return useQuery({
    queryKey: sportsKeys.leagues(),
    queryFn: () => provider.getLeagues(),
    staleTime: Infinity,
  });
}

export function useSeason(slug: LeagueSlug) {
  const provider = useSportsData();
  return useQuery({
    queryKey: sportsKeys.season(slug),
    queryFn: () => provider.getSeason(slug),
    staleTime: 60 * 60_000,
  });
}

export function useStandings(slug: LeagueSlug, options: StandingsOptions = {}) {
  const provider = useSportsData();
  return useQuery({
    queryKey: [...sportsKeys.standings(slug), options.includeForm !== false] as const,
    queryFn: () => provider.getStandings(slug, options),
  });
}

export function useMatches(slug: LeagueSlug, query: MatchQuery = {}) {
  const provider = useSportsData();
  return useQuery({
    queryKey: sportsKeys.matches(slug, query),
    queryFn: () => provider.getMatches(slug, query),
    refetchInterval: (q) => matchRefetchInterval(q.state.data),
  });
}

export function useTopScorers(slug: LeagueSlug, limit = 10) {
  const provider = useSportsData();
  return useQuery({
    queryKey: sportsKeys.scorers(slug, limit),
    queryFn: () => provider.getTopScorers(slug, limit),
  });
}

export interface UseMatchesByDateOptions {
  /** Server-rendered matches, so the first paint needs no request. */
  initialData?: Match[];
}

export function useMatchesByDate(date: string, options: UseMatchesByDateOptions = {}) {
  const provider = useSportsData();
  return useQuery({
    queryKey: sportsKeys.matchesByDate(date),
    queryFn: () => provider.getMatchesByDate(date),
    refetchInterval: (q) => matchRefetchInterval(q.state.data),
    staleTime: 20_000,
    ...(options.initialData ? { initialData: options.initialData } : {}),
  });
}

const unsupported = (what: string) => () =>
  Promise.reject(new Error(`The configured data source cannot provide ${what}`));

export function useMatch(slug: LeagueSlug, matchId: string) {
  const provider = useSportsData();
  return useQuery({
    queryKey: sportsKeys.match(slug, matchId),
    queryFn: provider.getMatch
      ? () => provider.getMatch!(slug, matchId)
      : unsupported('match details'),
    refetchInterval: (q) =>
      q.state.data && isLive(q.state.data.match.status) ? LIVE_REFETCH_MS : false,
  });
}

export function useTeam(slug: LeagueSlug, teamId: string) {
  const provider = useSportsData();
  return useQuery({
    queryKey: sportsKeys.team(slug, teamId),
    queryFn: provider.getTeam ? () => provider.getTeam!(slug, teamId) : unsupported('team pages'),
    staleTime: 5 * 60_000,
  });
}

export function usePlayer(slug: LeagueSlug, playerId: string) {
  const provider = useSportsData();
  return useQuery({
    queryKey: sportsKeys.player(slug, playerId),
    queryFn: provider.getPlayer
      ? () => provider.getPlayer!(slug, playerId)
      : unsupported('player pages'),
    staleTime: 5 * 60_000,
  });
}

export function useNews(leagues: readonly LeagueSlug[], limit = 8) {
  const provider = useSportsData();
  return useQuery({
    queryKey: sportsKeys.news(leagues, limit),
    queryFn: provider.getNews ? () => provider.getNews!(leagues, limit) : unsupported('news'),
    staleTime: 5 * 60_000,
  });
}

export function useArticle(articleId: string) {
  const provider = useSportsData();
  return useQuery({
    queryKey: sportsKeys.article(articleId),
    queryFn: provider.getArticle ? () => provider.getArticle!(articleId) : unsupported('articles'),
    staleTime: 10 * 60_000,
  });
}
