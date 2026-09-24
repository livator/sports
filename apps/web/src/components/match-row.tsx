import type { Match, MatchEvent, Team } from '@sports/core';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { matchHref, scoreText, sideWeight, statusLabel, statusTone, toneClass } from '@/lib/view';
import { Crest } from './crest';
import { LocalTime } from './local-time';

function Side({
  team,
  weight,
  redCards,
  redCardLabel,
}: {
  team: Team;
  weight: string;
  redCards: number;
  redCardLabel: string;
}) {
  return (
    <span className={`flex min-w-0 items-center gap-2 sm:gap-2.5 ${weight}`}>
      <Crest team={team} size={28} />
      <span className="truncate">{team.shortName}</span>
      {Array.from({ length: redCards }, (_, i) => (
        <span key={i} className="inline-block h-3 w-2 flex-none bg-accent">
          <span className="sr-only">{redCardLabel}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * One match on a single line: status, home, score, away. The row links to the match page.
 * Goalscorers stay out of the way in a panel that opens on hover or keyboard focus.
 */
export function MatchRow({ match, showDate = false }: { match: Match; showDate?: boolean }) {
  const t = useTranslations('match');
  const ts = useTranslations('status');
  const tone = statusTone(match);
  const events = match.events ?? [];
  const homeEvents = events.filter((e) => e.teamId === match.homeTeam.id);
  const awayEvents = events.filter((e) => e.teamId === match.awayTeam.id);
  const reds = (list: MatchEvent[]) => list.filter((e) => e.type === 'red-card').length;

  /** "B. Brobbey 12', 33', 59' · E. Haaland 81' (pen)", keeping first-goal order. */
  const summariseGoals = (list: MatchEvent[]): string => {
    const byPlayer = new Map<string, string[]>();
    for (const e of list) {
      const suffix =
        e.type === 'penalty-goal' ? ` (${t('pen')})` : e.type === 'own-goal' ? ` (${t('og')})` : '';
      const minutes = byPlayer.get(e.player) ?? [];
      minutes.push(`${e.minute}${suffix}`);
      byPlayer.set(e.player, minutes);
    }
    return [...byPlayer.entries()]
      .map(([player, minutes]) => `${player} ${minutes.join(', ')}`.trim())
      .join(' · ');
  };

  const eventLine = (team: Team, list: MatchEvent[]) => {
    if (list.length === 0) return null;
    const goals = list.filter((e) => e.type !== 'red-card');
    return (
      <span className="flex gap-2.5">
        <Crest team={team} size={16} />
        <span className="min-w-0 leading-snug">
          {goals.length > 0 && <span className="block">{summariseGoals(goals)}</span>}
          {list
            .filter((e) => e.type === 'red-card')
            .map((red, i) => (
              <span key={i} className="block text-ink-2">
                {t('sentOff', { player: `${red.player} ${red.minute}`.trim() })}
              </span>
            ))}
        </span>
      </span>
    );
  };

  return (
    <Link
      href={matchHref(match)}
      className="group relative grid grid-cols-[56px_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b px-1 py-4 hover:bg-hover sm:grid-cols-[72px_minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3"
    >
      <span className={`tnum text-[13px] font-bold ${toneClass[tone]}`}>
        {match.status === 'scheduled' ? (
          <>
            {showDate && (
              <span className="block font-normal text-ink-3">
                <LocalTime iso={match.kickoff} mode="date" />
              </span>
            )}
            <LocalTime iso={match.kickoff} />
          </>
        ) : (
          statusLabel(match, ts)
        )}
      </span>
      <Side
        team={match.homeTeam}
        weight={sideWeight(match, 'home')}
        redCards={reds(homeEvents)}
        redCardLabel={t('redCard')}
      />
      <span className="min-w-12 text-center tnum text-lg font-extrabold tracking-[-0.02em] sm:min-w-16 sm:text-[22px]">
        {scoreText(match)}
      </span>
      <Side
        team={match.awayTeam}
        weight={sideWeight(match, 'away')}
        redCards={reds(awayEvents)}
        redCardLabel={t('redCard')}
      />

      {events.length > 0 && (
        <span className="invisible absolute top-full right-0 left-0 z-10 -mt-px flex flex-col gap-1.5 border bg-surface px-3 py-2.5 text-[13px] opacity-0 transition-opacity duration-100 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100">
          {eventLine(match.homeTeam, homeEvents)}
          {eventLine(match.awayTeam, awayEvents)}
        </span>
      )}
    </Link>
  );
}
