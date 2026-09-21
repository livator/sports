import { type League, type Scorer } from '@sports/core';
import type { Locale } from '@sports/i18n';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CompetitionNav } from '@/components/competition-nav';
import { DataNotice } from '@/components/data-notice';
import { PageHeader } from '@/components/page-header';
import { ScorersTable, type ScorerRow } from '@/components/scorers-table';
import { competitionName, parseSelection } from '@/lib/competitions';
import { getProvider, safe } from '@/lib/provider';
import { seasonLabelFor } from '@/lib/view';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ league?: string }>;
};
type Row = Scorer & { league: League };

const LIMIT = 30;

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'players' });
  return { title: t('title') };
}

export default async function PlayersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('players');
  const tc = await getTranslations('competitions');

  const provider = getProvider();
  const leagues = ((await safe(provider.getLeagues())) ?? []).filter((l) => l.hasScorers);
  const selection = parseSelection((await searchParams).league, leagues);

  /*
   * One competition shows its own list. The Top 5 category (and the default) combines its
   * five leagues into one race. Other categories open on their first competition, because
   * combining a dozen leagues would mean a dozen large requests for one page.
   */
  const category =
    selection.kind === 'all'
      ? 'top5'
      : selection.kind === 'category'
        ? selection.category
        : selection.league.category;
  const inCategory = leagues.filter((l) => l.category === category);
  const combined = selection.kind !== 'league' && category === 'top5';
  const single =
    selection.kind === 'league' ? selection.league : combined ? null : (inCategory[0] ?? null);
  const sources = single ? [single] : inCategory;

  const lists = await Promise.all(
    sources.map(async (league) => {
      const scorers = await safe(provider.getTopScorers(league.slug, LIMIT));
      return scorers?.map((s): Row => ({ ...s, league })) ?? null;
    }),
  );
  const failed = lists.length > 0 && lists.every((l) => l === null);
  const rows = lists
    .flatMap((l) => l ?? [])
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.playedMatches - b.playedMatches)
    .slice(0, LIMIT);

  const picker = (
    <CompetitionNav
      leagues={leagues}
      activeCategory={category}
      activeLeague={single}
      categoryHref={(c) => (c === 'top5' ? '/players' : `/players?league=${c}`)}
      leagueHref={(l) => `/players?league=${l.slug}`}
      {...(category === 'top5'
        ? { leadingInCategory: { href: '/players', label: t('allLeagues'), active: combined } }
        : {})}
    />
  );

  return (
    <section>
      <PageHeader kicker={t('kicker', { season: seasonLabelFor(new Date()) })} title={t('title')} />
      {failed || rows.length === 0 ? (
        <>
          <div className="border-b py-3.5">{picker}</div>
          {failed ? (
            <DataNotice kind="scorers" />
          ) : (
            <p className="py-12 text-[17px] text-ink-2">{t('none')}</p>
          )}
        </>
      ) : (
        <ScorersTable
          rows={rows.map((row, i): ScorerRow => ({
            rank: i + 1,
            league: row.league.slug,
            leagueName: competitionName(row.league, tc, true),
            player: { id: row.player.id, name: row.player.name },
            team: { id: row.team.id, name: row.team.name, shortName: row.team.shortName },
            apps: row.playedMatches,
            assists: row.assists,
            goals: row.goals,
          }))}
        >
          {picker}
        </ScorersTable>
      )}
    </section>
  );
}
