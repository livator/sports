import { LEAGUES, findLeague, type League, type Scorer } from '@sports/core';
import type { Locale } from '@sports/i18n';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Chips } from '@/components/chips';
import { DataNotice } from '@/components/data-notice';
import { PageHeader } from '@/components/page-header';
import { Link } from '@/i18n/navigation';
import { getProvider, safe } from '@/lib/provider';
import { playerHref, seasonLabelFor, teamHref } from '@/lib/view';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ league?: string }>;
};
type Row = Scorer & { league: League };

const LIMIT = 20;

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'players' });
  return { title: t('title') };
}

export default async function PlayersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('players');

  const selected = findLeague((await searchParams).league ?? '');
  const provider = getProvider();
  const leagues = selected ? [selected] : [...LEAGUES];

  const lists = await Promise.all(
    leagues.map(async (league) => {
      const scorers = await safe(provider.getTopScorers(league.slug, LIMIT));
      return scorers?.map((s): Row => ({ ...s, league })) ?? null;
    }),
  );
  const failed = lists.every((l) => l === null);
  const rows = lists
    .flatMap((l) => l ?? [])
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.playedMatches - b.playedMatches)
    .slice(0, LIMIT);

  return (
    <section>
      <PageHeader kicker={t('kicker', { season: seasonLabelFor(new Date()) })} title={t('title')} />
      <div className="border-b py-3.5">
        <Chips
          label={t('league')}
          items={[
            { href: '/players', label: t('allLeagues'), active: !selected },
            ...LEAGUES.map((l) => ({
              href: `/players?league=${l.slug}`,
              label: l.shortName,
              active: selected?.slug === l.slug,
            })),
          ]}
        />
      </div>

      {failed ? (
        <DataNotice kind="scorers" />
      ) : rows.length === 0 ? (
        <p className="py-12 text-[17px] text-ink-2">{t('none')}</p>
      ) : (
        <div className="overflow-x-auto overflow-y-hidden pt-6">
          <table className="table min-w-[560px]">
            <thead>
              <tr>
                <th scope="col" className="w-10">
                  #
                </th>
                <th scope="col">{t('player')}</th>
                <th scope="col">{t('club')}</th>
                <th scope="col">{t('league')}</th>
                <th scope="col" className="num">
                  {t('apps')}
                </th>
                <th scope="col" className="num">
                  {t('assists')}
                </th>
                <th scope="col" className="num">
                  {t('goals')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.league.slug}-${row.player.id}`}>
                  <td className="text-ink-3">{i + 1}</td>
                  <td className="font-semibold">
                    <Link
                      href={playerHref(row.league.slug, row.player.id)}
                      className="hover:text-accent"
                    >
                      {row.player.name}
                    </Link>
                  </td>
                  <td>
                    <Link
                      href={teamHref(row.league.slug, row.team.id)}
                      className="hover:text-accent"
                    >
                      {row.team.shortName}
                    </Link>
                  </td>
                  <td className="text-ink-3">{row.league.shortName}</td>
                  <td className="num">{row.playedMatches}</td>
                  <td className="num">{row.assists}</td>
                  <td className="num text-lg font-extrabold">{row.goals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
