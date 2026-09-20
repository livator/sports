import { signed, type League, type Scorer, type Standings } from '@sports/core';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { playerHref, teamHref, zoneEdgeClass } from '@/lib/view';
import { ClubName } from './favourites';

/** Scoreboard sidebar: the top of one league's table and its leading scorers. */
export function HomeAside({
  league,
  standings,
  scorers,
}: {
  league: League;
  standings: Standings | null;
  scorers: Scorer[] | null;
}) {
  const t = useTranslations('home');
  const tt = useTranslations('table');
  return (
    <aside className="max-w-[420px] min-w-0 flex-[1_1_300px]">
      <div className="flex items-baseline justify-between gap-3 pb-2.5">
        <h2 className="eyebrow">{t('tableTitle', { league: league.shortName })}</h2>
        <Link href={`/tables/${league.slug}`} className="text-xs text-accent-700 hover:text-accent">
          {t('fullTable')}
        </Link>
      </div>
      {standings ? (
        <table className="table">
          <thead>
            <tr>
              <th scope="col" className="w-8">
                #
              </th>
              <th scope="col">{tt('club')}</th>
              <th scope="col" className="num">
                {tt('played')}
              </th>
              <th scope="col" className="num">
                {tt('goalDiff')}
              </th>
              <th scope="col" className="num">
                {tt('points')}
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.rows.slice(0, 8).map((row) => (
              <tr key={row.team.id}>
                <td className={`border-l-[3px] text-ink-3 ${zoneEdgeClass(league, row.position)}`}>
                  {row.position}
                </td>
                <td>
                  <Link href={teamHref(league.slug, row.team.id)} className="hover:text-accent">
                    <ClubName teamId={row.team.id}>{row.team.shortName}</ClubName>
                  </Link>
                </td>
                <td className="num text-ink-3">{row.played}</td>
                <td className="num">{signed(row.goalDifference)}</td>
                <td className="num font-extrabold">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <div className="rule-2" />
          <p className="py-4 text-sm text-ink-2">{t('tableUnavailable')}</p>
        </>
      )}

      <div className="flex items-baseline justify-between gap-3 pt-9 pb-2.5">
        <h2 className="eyebrow">{t('topScorers')}</h2>
        <Link
          href={`/players?league=${league.slug}`}
          className="text-xs text-accent-700 hover:text-accent"
        >
          {t('allPlayers')}
        </Link>
      </div>
      <div className="rule-2" />
      {scorers && scorers.length > 0 ? (
        scorers.slice(0, 5).map((s) => (
          <Link
            key={s.player.id}
            href={playerHref(league.slug, s.player.id)}
            className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 border-b px-1 py-2.5 text-sm hover:bg-hover"
          >
            <span className="tnum text-ink-3">{s.rank}</span>
            <span className="min-w-0 truncate">
              <span className="font-semibold">{s.player.name}</span>{' '}
              <span className="text-ink-3">{s.team.shortName}</span>
            </span>
            <span className="tnum text-lg font-extrabold">{s.goals}</span>
          </Link>
        ))
      ) : (
        <p className="py-4 text-sm text-ink-2">
          {scorers ? t('noGoalsYet') : t('scorersUnavailable')}
        </p>
      )}
    </aside>
  );
}
