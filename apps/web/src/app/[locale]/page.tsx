import { DEFAULT_LEAGUE, isIsoDate, type League, type Match } from '@sports/core';
import type { Locale } from '@sports/i18n';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CompetitionNav } from '@/components/competition-nav';
import { DaySwitcher, dayLabel } from '@/components/day-switcher';
import { HomeAside } from '@/components/home-aside';
import { NewsList } from '@/components/news-list';
import { Scoreboard } from '@/components/scoreboard';
import { Shell } from '@/components/shell';
import { YourClubs } from '@/components/your-clubs';
import {
  competitionName,
  parseSelection,
  selectionCategory,
  selectionParam,
  selectionSlugs,
  type Selection,
} from '@/lib/competitions';
import { getProvider, safe } from '@/lib/provider';
import { viewerToday } from '@/lib/today';
import { dotted, homeHref } from '@/lib/view';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ date?: string; league?: string }>;
};

const NEWS_COUNT = 7;

/**
 * Which competition the right-hand table shows. A single pick wins. For a category or "all"
 * it is the first competition with a table that actually has matches on this day, so a
 * Champions League night shows the Champions League table without anyone choosing it.
 */
function sidebarLeague(
  selection: Selection,
  available: readonly League[],
  matches: Match[] | null,
): League {
  const fallback = available.find((l) => l.slug === DEFAULT_LEAGUE) ?? available[0]!;
  if (selection.kind === 'league') return selection.league.hasTable ? selection.league : fallback;
  const pool = available.filter(
    (l) => l.hasTable && (selection.kind === 'all' || l.category === selection.category),
  );
  const playing = new Set((matches ?? []).map((m) => m.leagueSlug));
  return (
    pool.find((l) => playing.has(l.slug)) ??
    (selection.kind === 'all' ? fallback : (pool[0] ?? fallback))
  );
}

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const td = await getTranslations('days');
  const tn = await getTranslations('news');
  const tc = await getTranslations('competitions');

  const query = await searchParams;
  const today = await viewerToday();
  const date = query.date && isIsoDate(query.date) ? query.date : today;

  const provider = getProvider();
  const leagues = (await safe(provider.getLeagues())) ?? [];
  const selection = parseSelection(query.league, leagues);
  const slugs = selectionSlugs(selection, leagues);

  // The news follows the competition filter, like the rest of the page.
  const [matches, news] = await Promise.all([
    safe(provider.getMatchesByDate(date)),
    provider.getNews ? safe(provider.getNews(slugs ?? [], NEWS_COUNT)) : Promise.resolve(null),
  ]);
  const shown = slugs ? (matches ?? []).filter((m) => slugs.includes(m.leagueSlug)) : matches;
  const side = sidebarLeague(selection, leagues, shown);
  const [standings, scorers] = await Promise.all([
    safe(provider.getStandings(side.slug, { includeForm: false })),
    side.hasScorers ? safe(provider.getTopScorers(side.slug, 5)) : Promise.resolve([]),
  ]);

  const day = dayLabel(date, today, locale, td);
  const kicker =
    date === today
      ? t('kickerToday')
      : date < today
        ? t('kickerPast', { day })
        : t('kickerFuture', { day });
  const newsFilter =
    selection.kind === 'league'
      ? competitionName(selection.league, tc, true)
      : selection.kind === 'category'
        ? tc(`categories.${selection.category}`)
        : tn('filterAll');
  const newsList = provider.getNews ? <NewsList articles={news} filterLabel={newsFilter} /> : null;

  return (
    <Shell
      aside={
        <>
          {newsList}
          <YourClubs />
        </>
      }
    >
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4 pt-10 pb-5">
          <div>
            <span className="mb-2.5 block kicker">{kicker}</span>
            <h1 className="display tnum" aria-label={t('heading', { date: dotted(date) })}>
              {dotted(date)}
            </h1>
          </div>
          <DaySwitcher date={date} today={today} league={selectionParam(selection)} />
        </div>
        <div className="rule-2" />
        <Scoreboard
          date={date}
          slugs={slugs}
          scope={selection.kind}
          initialMatches={matches}
          picker={
            <CompetitionNav
              leagues={leagues}
              activeCategory={selectionCategory(selection)}
              activeLeague={selection.kind === 'league' ? selection.league : null}
              leading={{
                href: homeHref({ date, today }),
                label: t('all'),
                active: selection.kind === 'all',
              }}
              categoryHref={(category) => homeHref({ date, today, league: category })}
              leagueHref={(league) => homeHref({ date, today, league: league.slug })}
            />
          }
          aside={<HomeAside league={side} standings={standings} scorers={scorers} />}
        />
      </section>

      {/* The design hides the sidebar below 900px; the news moves under the matches instead of vanishing. */}
      {newsList && <div className="pt-12 min-[900px]:hidden">{newsList}</div>}
    </Shell>
  );
}
