import { LEAGUES, findLeague, signed } from '@sports/core';
import type { Locale } from '@sports/i18n';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Chips } from '@/components/chips';
import { Crest } from '@/components/crest';
import { DataNotice } from '@/components/data-notice';
import { ClubName } from '@/components/favourites';
import { FormPips } from '@/components/form-pips';
import { PageHeader } from '@/components/page-header';
import { Link } from '@/i18n/navigation';
import { getProvider, safe } from '@/lib/provider';
import { teamHref, zoneEdgeClass } from '@/lib/view';

export const revalidate = 60;
/** Only the five configured leagues exist; anything else is a hard 404. */
export const dynamicParams = false;

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export function generateStaticParams() {
  return LEAGUES.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const league = findLeague(slug);
  if (!league) return {};
  const t = await getTranslations({ locale, namespace: 'table' });
  return { title: t('title', { league: league.name }) };
}

export default async function TablePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const league = findLeague(slug);
  if (!league) notFound();
  const t = await getTranslations('table');

  const standings = await safe(getProvider().getStandings(league.slug));
  const played = standings ? Math.max(0, ...standings.rows.map((r) => r.played)) : 0;
  const hasForm = standings?.rows.some((r) => r.form.length > 0) ?? false;
  const num = (label: string) => (
    <th scope="col" className="num">
      {label}
    </th>
  );

  return (
    <section>
      <PageHeader
        kicker={standings ? t('kicker', { season: standings.season, played }) : league.country}
        title={league.name}
      />
      <div className="flex flex-wrap items-center gap-x-6 border-b py-3.5">
        <Chips
          label={t('leagues')}
          items={LEAGUES.map((l) => ({
            href: `/tables/${l.slug}`,
            label: l.shortName,
            active: l.slug === league.slug,
          }))}
        />
        <Link
          href={`/tables/${league.slug}/fixtures`}
          className="text-[13px] text-accent-700 hover:text-accent"
        >
          {t('fixturesLink')}
        </Link>
      </div>

      {!standings ? (
        <DataNotice kind="table" />
      ) : (
        <>
          <div className="overflow-x-auto overflow-y-hidden pt-6">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th scope="col" className="w-10">
                    #
                  </th>
                  <th scope="col">{t('club')}</th>
                  {num(t('played'))}
                  {num(t('won'))}
                  {num(t('drawn'))}
                  {num(t('lost'))}
                  {num(t('goals'))}
                  {num(t('goalDiff'))}
                  {num(t('points'))}
                  {hasForm && num(t('form'))}
                </tr>
              </thead>
              <tbody>
                {standings.rows.map((row) => (
                  <tr key={row.team.id}>
                    <td
                      className={`border-l-[3px] text-ink-3 ${zoneEdgeClass(league, row.position)}`}
                    >
                      {row.position}
                    </td>
                    <td>
                      <Link
                        href={teamHref(league.slug, row.team.id)}
                        className="inline-flex items-center gap-2.5 hover:text-accent"
                      >
                        <Crest team={row.team} size={22} />
                        <ClubName teamId={row.team.id}>{row.team.shortName}</ClubName>
                      </Link>
                    </td>
                    <td className="num">{row.played}</td>
                    <td className="num">{row.won}</td>
                    <td className="num">{row.drawn}</td>
                    <td className="num">{row.lost}</td>
                    <td className="num text-ink-3">
                      {row.goalsFor}:{row.goalsAgainst}
                    </td>
                    <td className="num">{signed(row.goalDifference)}</td>
                    <td className="num font-extrabold">{row.points}</td>
                    {hasForm && (
                      <td className="num">
                        <FormPips form={row.form} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-4 text-xs text-ink-2">
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 bg-accent" />
              {t('zoneChampions')}
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 bg-ink" />
              {t('zoneEurope')}
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 bg-neutral-400" />
              {t('zoneRelegation')}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
