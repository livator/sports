import type { League, Standings } from '@sports/core';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { TeamBadge } from './team-badge';

export function LeagueCard({ league, standings }: { league: League; standings: Standings }) {
  const top = standings.rows.slice(0, 3);
  const leader = top[0];

  return (
    <Link
      href={`/leagues/${league.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-3xl p-5 glass transition hover:-translate-y-0.5 hover:border-line-strong"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full opacity-40 blur-3xl transition group-hover:opacity-70"
        style={{ background: league.colors.primary }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium tracking-wider text-ink-muted uppercase">
            <span aria-hidden className="mr-1.5">
              {league.flag}
            </span>
            {league.country} · {standings.season}
          </p>
          <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight">{league.name}</h3>
        </div>
        <ArrowUpRight className="size-5 text-ink-faint transition group-hover:text-ink" />
      </div>

      {leader && (
        <div className="relative mt-5 flex items-center gap-3 rounded-2xl bg-black/20 p-3">
          <TeamBadge team={leader.team} size="lg" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-widest text-ink-faint uppercase">
              Leader
            </p>
            <p className="truncate font-medium">{leader.team.shortName}</p>
          </div>
          <p className="ml-auto font-display text-2xl font-bold tabular">
            {leader.points}
            <span className="ml-1 text-xs font-medium text-ink-muted">pts</span>
          </p>
        </div>
      )}

      <ol className="relative mt-4 space-y-1.5 text-sm">
        {top.map((row) => (
          <li key={row.team.id} className="flex items-center gap-2.5">
            <span className="w-4 text-ink-faint tabular">{row.position}</span>
            <TeamBadge team={row.team} size="sm" />
            <span className="truncate text-ink-muted">{row.team.shortName}</span>
            <span className="ml-auto font-medium tabular">{row.points}</span>
          </li>
        ))}
      </ol>
    </Link>
  );
}
