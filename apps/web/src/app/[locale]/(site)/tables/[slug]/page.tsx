import {
  findLeague,
  signed,
  zoneOf,
  type League,
  type StandingRow,
  type ZoneKind,
} from '@sports/core';
import type { Locale } from '@sports/i18n';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CompetitionNav } from '@/components/competition-nav';
import { Crest } from '@/components/crest';
import { DataNotice } from '@/components/data-notice';
import { ClubName } from '@/components/favourites';
import { FormPips } from '@/components/form-pips';
import { PageHeader } from '@/components/page-header';
import { Link } from '@/i18n/navigation';
import { competitionName, groupName } from '@/lib/competitions';
import { getProvider, safe } from '@/lib/provider';
import { teamHref, zoneEdgeClass, zoneSwatchClass, zoneTone } from '@/lib/view';

export const revalidate = 60;

type Props = { params: Promise<{ locale: Locale; slug: string }> };

/** Rendered on first request and then cached; prerendering 22 competitions x 3 languages at build would hammer the data source. */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const league = findLeague(slug);
  if (!league) return {};
  const t = await getTranslations({ locale, namespace: 'table' });
  const tc = await getTranslations({ locale, namespace: 'competitions' });
  return { title: t('title', { league: competitionName(league, tc) }) };
}

/** Order zones appear in the legend: best outcome first. */
const LEGEND_ORDER: ZoneKind[] = [
  'champions-league',
  'advance',
  'europa-league',
  'conference-league',
  'playoff',
  'relegation-playoff',
  'relegation',
  'eliminated',
];

export default async function TablePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const league = findLeague(slug);
  if (!league) notFound();
  const t = await getTranslations('table');
  const tc = await getTranslations('competitions');

  const provider = getProvider();
  const [leagues, standings] = await Promise.all([
    safe(provider.getLeagues()),
    league.hasTable ? safe(provider.getStandings(league.slug)) : Promise.resolve(null),
  ]);
  const rows = standings?.rows ?? [];
  const played = Math.max(0, ...rows.map((r) => r.played));
  const hasForm = rows.some((r) => r.form.length > 0);
  const zonesUsed = new Set(rows.map((r) => zoneOf(league, r)).filter((z) => z !== null));
  const name = competitionName(league, tc);
  // Club sides are shown by short name; countries read better in full.
  const teamLabel = (row: StandingRow) =>
    league.category === 'national' ? row.team.name : row.team.shortName;

  const num = (label: string) => (
    <th scope="col" className="num">
      {label}
    </th>
  );

  /*
   * Grouped competitions sit two tables to a row, so they use a compact column set that fits
   * half the page: no goals-for:against and no form, and no minimum width to scroll.
   */
  const table = (tableRows: StandingRow[], compact = false) => (
    <div className="overflow-x-auto overflow-y-hidden">
      <table className={`table ${compact ? '' : 'min-w-[720px]'}`}>
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
            {!compact && num(t('goals'))}
            {num(t('goalDiff'))}
            {num(t('points'))}
            {hasForm && !compact && num(t('form'))}
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row) => (
            <tr key={row.team.id}>
              <td className={`border-l-[3px] text-ink-3 ${zoneEdgeClass(league, row)}`}>
                {row.position}
              </td>
              <td>
                <Link
                  href={teamHref(league.slug, row.team.id)}
                  className="inline-flex items-center gap-2.5 hover:text-accent"
                >
                  <Crest team={row.team} size={22} />
                  <ClubName teamId={row.team.id}>{teamLabel(row)}</ClubName>
                </Link>
              </td>
              <td className="num">{row.played}</td>
              <td className="num">{row.won}</td>
              <td className="num">{row.drawn}</td>
              <td className="num">{row.lost}</td>
              {!compact && (
                <td className="num text-ink-3">
                  {row.goalsFor}:{row.goalsAgainst}
                </td>
              )}
              <td className="num">{signed(row.goalDifference)}</td>
              <td className="num font-extrabold">{row.points}</td>
              {hasForm && !compact && (
                <td className="num">
                  <FormPips form={row.form} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <section>
      <PageHeader
        kicker={
          standings && rows.length > 0
            ? t('kicker', { season: standings.season, played })
            : league.country
        }
        title={name}
      />
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2 border-b py-3.5">
        <CompetitionNav
          leagues={leagues ?? [league]}
          activeCategory={league.category}
          activeLeague={league}
          keep={(l: League) => l.hasTable}
          categoryHref={(category) => {
            const first = (leagues ?? []).find((l) => l.category === category && l.hasTable);
            return `/tables/${first?.slug ?? league.slug}`;
          }}
          leagueHref={(l) => `/tables/${l.slug}`}
        />
        <Link
          href={`/tables/${league.slug}/fixtures`}
          className="flex-none py-1.5 text-[13px] text-accent-700 hover:text-accent"
        >
          {t('fixturesLink')}
        </Link>
      </div>

      {!league.hasTable ? (
        <p className="py-12 text-[17px] text-ink-2">{tc('noTable')}</p>
      ) : !standings ? (
        <DataNotice kind="table" />
      ) : rows.length === 0 ? (
        <p className="py-12 text-[17px] text-ink-2">{tc('emptyTable')}</p>
      ) : (
        <>
          {standings.groups ? (
            <div className="grid gap-x-14 gap-y-10 pt-8 lg:grid-cols-2">
              {standings.groups.map((group) => (
                <section key={group.name} className="min-w-0">
                  <h2 className="pb-2.5 eyebrow">{groupName(group.name, tc)}</h2>
                  {table(group.rows, true)}
                </section>
              ))}
            </div>
          ) : (
            <div className="pt-6">{table(rows)}</div>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-4 text-xs text-ink-2">
            {LEGEND_ORDER.filter((zone) => zonesUsed.has(zone)).map((zone) => (
              <span key={zone} className="flex items-center gap-2">
                <span aria-hidden className={`size-2.5 ${zoneSwatchClass[zoneTone[zone]]}`} />
                {t(`zones.${zone}`)}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
