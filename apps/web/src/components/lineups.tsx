import type { LeagueSlug, LineupPlayer, MatchLineups, Team } from '@sports/core';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { playerHref } from '@/lib/view';

function PitchPlayer({
  player,
  league,
  solid,
}: {
  player: LineupPlayer;
  league: LeagueSlug;
  solid: boolean;
}) {
  const t = useTranslations('match');
  return (
    <Link
      href={playerHref(league, player.id)}
      title={player.name}
      aria-label={player.subbedOut ? t('wentOff', { player: player.name }) : player.name}
      className="group flex min-w-0 flex-1 flex-col items-center gap-1"
    >
      <span
        className={`grid size-[30px] place-items-center border border-ink tnum text-xs font-extrabold ${
          solid ? 'bg-ink text-ground' : 'bg-ground text-ink'
        }`}
      >
        {player.number ?? ''}
      </span>
      <span className="max-w-full truncate text-[11px] group-hover:text-accent">
        {player.shortName}
      </span>
    </Link>
  );
}

function BenchName({
  player,
  league,
  align,
}: {
  player: LineupPlayer | undefined;
  league: LeagueSlug;
  align: 'start' | 'end';
}) {
  const t = useTranslations('match');
  if (!player) return <span />;
  return (
    <Link
      href={playerHref(league, player.id)}
      // Substitutes who played are set heavier, like a winner in a score line.
      className={`truncate hover:text-accent ${align === 'end' ? 'text-right' : ''} ${
        player.subbedIn ? 'font-semibold' : 'text-ink-2'
      }`}
      {...(player.subbedIn ? { 'aria-label': t('cameOn', { player: player.name }) } : {})}
    >
      {align === 'start' && player.number ? (
        <span className="mr-2 tnum text-ink-3">{player.number}</span>
      ) : null}
      {player.name}
      {align === 'end' && player.number ? (
        <span className="ml-2 tnum text-ink-3">{player.number}</span>
      ) : null}
    </Link>
  );
}

/**
 * Both starting XIs on one pitch, home at the top attacking down, away at the bottom
 * attacking up. Core stores each line from the team's own left to its right, so the home
 * side is mirrored here: seen from above, a team facing down has its right on our left.
 */
export function Lineups({
  lineups,
  home,
  away,
  league,
}: {
  lineups: MatchLineups;
  home: Team;
  away: Team;
  league: LeagueSlug;
}) {
  const t = useTranslations('match');
  const rows = [
    ...lineups.home.rows.map((players) => ({ players: [...players].reverse(), solid: true })),
    ...[...lineups.away.rows].reverse().map((players) => ({ players, solid: false })),
  ];
  const halfway = lineups.home.rows.length - 1;
  const benchSize = Math.max(lineups.home.bench.length, lineups.away.bench.length);
  const heading = (team: Team, formation: string | undefined) =>
    formation ? `${team.shortName} · ${formation}` : team.shortName;

  return (
    <div className="flex flex-wrap gap-x-14 gap-y-10 pt-8">
      <div className="max-w-[560px] min-w-0 flex-[1_1_420px]">
        <div className="flex justify-between gap-4 pb-2.5 eyebrow">
          <span>{heading(home, lineups.home.formation)}</span>
          <span className="text-right">{heading(away, lineups.away.formation)}</span>
        </div>
        <div className="rule-2" />
        <div className="mt-4 flex flex-col border-2 border-ink bg-neutral-200">
          {rows.map((row, i) => (
            <div
              key={i}
              className={`flex justify-around px-2 py-3 ${
                i === halfway
                  ? 'border-b-2 border-ink'
                  : i === rows.length - 1
                    ? ''
                    : 'border-b border-ink/15'
              }`}
            >
              {row.players.map((player) => (
                <PitchPlayer key={player.id} player={player} league={league} solid={row.solid} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-[420px] min-w-0 flex-[1_1_280px]">
        <h2 className="pb-2.5 eyebrow">{t('bench')}</h2>
        <div className="rule-2" />
        {Array.from({ length: benchSize }, (_, i) => (
          <div key={i} className="grid grid-cols-2 gap-4 border-b py-2.5 text-sm">
            <BenchName player={lineups.home.bench[i]} league={league} align="start" />
            <BenchName player={lineups.away.bench[i]} league={league} align="end" />
          </div>
        ))}
        <p className="mt-4 text-[13px] text-ink-2">{t('lineupsNote')}</p>
      </div>
    </div>
  );
}
