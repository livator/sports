import { LEAGUES, findLeague, isIsoDate, type LeagueSlug } from '@sports/core';
import type { Locale } from '@sports/i18n';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Chips } from '@/components/chips';
import { DaySwitcher, dayLabel } from '@/components/day-switcher';
import { HomeAside } from '@/components/home-aside';
import { Scoreboard } from '@/components/scoreboard';
import { getProvider, safe } from '@/lib/provider';
import { viewerToday } from '@/lib/today';
import { dotted, homeHref } from '@/lib/view';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ date?: string; league?: string }>;
};

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const td = await getTranslations('days');

  const query = await searchParams;
  const today = await viewerToday();
  const date = query.date && isIsoDate(query.date) ? query.date : today;
  const league: LeagueSlug | 'all' = findLeague(query.league ?? '')?.slug ?? 'all';
  // The sidebar follows the league filter, and shows the Premier League under "All".
  const sideLeague = findLeague(league) ?? LEAGUES[0]!;

  const provider = getProvider();
  const [matches, standings, scorers] = await Promise.all([
    safe(provider.getMatchesByDate(date)),
    safe(provider.getStandings(sideLeague.slug, { includeForm: false })),
    safe(provider.getTopScorers(sideLeague.slug, 5)),
  ]);

  const day = dayLabel(date, today, locale, td);
  const kicker =
    date === today
      ? t('kickerToday')
      : date < today
        ? t('kickerPast', { day })
        : t('kickerFuture', { day });

  const chips = [
    { href: homeHref({ date, today, league: 'all' }), label: t('all'), active: league === 'all' },
    ...LEAGUES.map((l) => ({
      href: homeHref({ date, today, league: l.slug }),
      label: l.shortName,
      active: league === l.slug,
    })),
  ];

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-10 pb-5">
        <div>
          <span className="mb-2.5 block kicker">{kicker}</span>
          <h1 className="display tnum" aria-label={t('heading', { date: dotted(date) })}>
            {dotted(date)}
          </h1>
        </div>
        <DaySwitcher date={date} today={today} league={league} />
      </div>
      <div className="rule-2" />
      <Scoreboard
        date={date}
        league={league}
        initialMatches={matches}
        chips={<Chips items={chips} label={t('competition')} />}
        aside={<HomeAside league={sideLeague} standings={standings} scorers={scorers} />}
      />
    </section>
  );
}
