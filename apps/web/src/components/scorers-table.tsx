import type { Scorer } from '@sports/core';
import { cn } from '@/lib/utils';
import { TeamBadge } from './team-badge';

export function ScorersTable({ scorers }: { scorers: Scorer[] }) {
  const max = Math.max(1, ...scorers.map((s) => s.goals));
  return (
    <div className="overflow-hidden rounded-2xl glass">
      <ol className="divide-y divide-line/60">
        {scorers.map((s) => (
          <li
            key={s.player.id}
            className="relative grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03] sm:grid-cols-[2.5rem_1fr_6rem_4rem_4rem_4rem]"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-pitch-500/15 to-transparent"
              style={{ width: `${(s.goals / max) * 100}%` }}
            />
            <span
              className={cn(
                'relative font-display text-lg font-bold tabular',
                s.rank === 1 ? 'text-pitch-400' : 'text-ink-muted',
              )}
            >
              {s.rank}
            </span>
            <span className="relative flex min-w-0 items-center gap-3">
              <TeamBadge team={s.team} size="md" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{s.player.name}</span>
                <span className="block truncate text-xs text-ink-muted">
                  {s.team.shortName}
                  {s.player.nationality ? ` · ${s.player.nationality}` : ''}
                </span>
              </span>
            </span>
            <span className="relative hidden text-center text-sm text-ink-muted tabular sm:block">
              <Stat label="Played" value={s.playedMatches} />
            </span>
            <span className="relative hidden text-center text-sm text-ink-muted tabular sm:block">
              <Stat label="Assists" value={s.assists} />
            </span>
            <span className="relative hidden text-center text-sm text-ink-muted tabular sm:block">
              <Stat label="Pens" value={s.penalties} />
            </span>
            <span className="relative text-right font-display text-xl font-bold tabular">
              {s.goals}
              <span className="ml-1 text-[10px] font-medium tracking-wider text-ink-faint uppercase">
                goals
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <>
      <span className="block text-base text-ink">{value}</span>
      <span className="block text-[10px] tracking-wider uppercase">{label}</span>
    </>
  );
}
