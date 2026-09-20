import { isLive, matchStatusLabel, type Match } from '@sports/core';
import { cn } from '@/lib/utils';
import { LocalTime } from './local-time';
import { TeamBadge } from './team-badge';

function Side({ match, side }: { match: Match; side: 'home' | 'away' }) {
  const team = side === 'home' ? match.homeTeam : match.awayTeam;
  const goals = match.score[side];
  const other = match.score[side === 'home' ? 'away' : 'home'];
  const finished = match.status === 'finished';
  const lost = finished && goals !== null && other !== null && goals < other;

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-3',
        side === 'away' && 'flex-row-reverse text-right',
        lost && 'text-ink-muted',
      )}
    >
      <TeamBadge team={team} size="lg" />
      <span className="truncate font-medium">
        <span className="hidden sm:inline">{team.shortName}</span>
        <span className="sm:hidden">{team.tla}</span>
      </span>
    </div>
  );
}

export function MatchCard({ match, className }: { match: Match; className?: string }) {
  const live = isLive(match.status);
  const scheduled = match.status === 'scheduled';
  const label = matchStatusLabel(match, 'en-GB', 'UTC');

  return (
    <article
      className={cn(
        'grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl px-4 py-3.5 glass transition hover:border-line-strong',
        live &&
          'border-live/40 shadow-[0_0_0_1px_rgb(255_59_92/0.25),0_12px_40px_-16px_rgb(255_59_92/0.4)]',
        className,
      )}
    >
      <Side match={match} side="home" />

      <div className="flex flex-col items-center gap-1">
        {scheduled ? (
          <span className="rounded-lg bg-surface-3 px-3 py-1.5 font-display text-sm font-semibold">
            <LocalTime iso={match.kickoff} />
          </span>
        ) : (
          <span className="font-display text-2xl font-bold tracking-tight tabular">
            {match.score.home ?? 0}
            <span className="mx-1.5 text-ink-faint">:</span>
            {match.score.away ?? 0}
          </span>
        )}
        <span
          className={cn(
            'flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase',
            live ? 'text-live' : 'text-ink-faint',
          )}
        >
          {live && (
            <span className="inline-block size-1.5 animate-pulse-live rounded-full bg-live" />
          )}
          {scheduled ? 'Kick-off' : label}
        </span>
      </div>

      <Side match={match} side="away" />
    </article>
  );
}
