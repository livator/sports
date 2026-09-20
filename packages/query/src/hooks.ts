'use client';

import type { LeagueSlug, Match, MatchQuery } from '@sports/core';
import { isLive } from '@sports/core';
import { useQuery } from '@tanstack/react-query';
import { sportsKeys } from './keys';
import { useSportsData } from './provider';

const LIVE_REFETCH_MS = 30_000;

function liveRefetchInterval(matches: Match[] | undefined): number | false {
  return matches?.some((m) => isLive(m.status)) ? LIVE_REFETCH_MS : false;
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

export function useStandings(slug: LeagueSlug) {
  const provider = useSportsData();
  return useQuery({
    queryKey: sportsKeys.standings(slug),
    queryFn: () => provider.getStandings(slug),
  });
}

export function useMatches(slug: LeagueSlug, query: MatchQuery = {}) {
  const provider = useSportsData();
  return useQuery({
    queryKey: sportsKeys.matches(slug, query),
    queryFn: () => provider.getMatches(slug, query),
    refetchInterval: (q) => liveRefetchInterval(q.state.data),
  });
}

export function useTopScorers(slug: LeagueSlug, limit = 10) {
  const provider = useSportsData();
  return useQuery({
    queryKey: sportsKeys.scorers(slug, limit),
    queryFn: () => provider.getTopScorers(slug, limit),
  });
}

export function useMatchesByDate(date: string) {
  const provider = useSportsData();
  return useQuery({
    queryKey: sportsKeys.matchesByDate(date),
    queryFn: () => provider.getMatchesByDate(date),
    refetchInterval: (q) => liveRefetchInterval(q.state.data),
  });
}
