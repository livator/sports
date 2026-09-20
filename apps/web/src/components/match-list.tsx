import { groupMatchesByDate, type Match } from '@sports/core';
import { LocalTime } from './local-time';
import { MatchCard } from './match-card';

export function MatchList({
  matches,
  emptyText = 'No matches.',
}: {
  matches: Match[];
  emptyText?: string;
}) {
  if (matches.length === 0) {
    return <p className="rounded-2xl px-4 py-8 text-center text-ink-muted glass">{emptyText}</p>;
  }
  const groups = groupMatchesByDate(matches);
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.date} className="space-y-2">
          <h3 className="px-1 text-xs font-semibold tracking-widest text-ink-faint uppercase">
            <LocalTime iso={group.matches[0]!.kickoff} mode="date" />
          </h3>
          <div className="space-y-2">
            {group.matches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
