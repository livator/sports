'use client';

import { getLeague, isLive, type Match } from '@sports/core';
import { useMatchesByDate } from '@sports/query';
import Link from 'next/link';
import { MatchCard } from './match-card';

/**
 * Today's matches across all leagues. Server-rendered with `initialMatches`,
 * then kept fresh on the client through the shared query hooks (30s while live).
 */
export function LiveMatches({ date, initialMatches }: { date: string; initialMatches: Match[] }) {
  const { data: matches = initialMatches, isFetching } = useMatchesByDate(date);
  const liveCount = matches.filter((m) => isLive(m.status)).length;

  if (matches.length === 0) {
    return (
      <p className="rounded-2xl px-4 py-8 text-center text-ink-muted glass">
        No matches today. Check each league’s fixtures for the next matchday.
      </p>
    );
  }

  const byLeague = new Map<string, Match[]>();
  for (const m of matches) {
    const list = byLeague.get(m.leagueSlug) ?? [];
    list.push(m);
    byLeague.set(m.leagueSlug, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-xs text-ink-muted">
        {liveCount > 0 ? (
          <span className="flex items-center gap-1.5 font-semibold text-live">
            <span className="inline-block size-1.5 animate-pulse-live rounded-full bg-live" />
            {liveCount} live now
          </span>
        ) : (
          <span>{matches.length} matches today</span>
        )}
        {isFetching && <span className="text-ink-faint">· updating</span>}
      </div>

      {[...byLeague.entries()].map(([slug, list]) => {
        const league = getLeague(slug as Match['leagueSlug']);
        return (
          <section key={slug} className="space-y-2">
            <Link
              href={`/leagues/${slug}`}
              className="flex items-center gap-2 px-1 text-xs font-semibold tracking-widest text-ink-faint uppercase transition hover:text-ink"
            >
              <span aria-hidden>{league.flag}</span>
              {league.name}
            </Link>
            <div className="grid gap-2 lg:grid-cols-2">
              {list.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
