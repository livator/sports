import {
  findLeague,
  groupMatchesByDate,
  isIsoMonth,
  monthBounds,
  shiftIsoMonth,
} from '@sports/core';
import { LOCALE_TAGS, type Locale } from '@sports/i18n';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { DataNotice } from '@/components/data-notice';
import { LocalTime } from '@/components/local-time';
import { MatchRow } from '@/components/match-row';
import { BackLink, PageHeader } from '@/components/page-header';
import { Link } from '@/i18n/navigation';
import { getProvider, safe } from '@/lib/provider';
import { viewerToday } from '@/lib/today';

type Props = {
  params: Promise<{ locale: Locale; slug: string }>;
  searchParams: Promise<{ month?: string }>;
};

const at = (month: string) => new Date(`${month}-15T12:00:00Z`);
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const league = findLeague(slug);
  if (!league) return {};
  const t = await getTranslations({ locale, namespace: 'fixtures' });
  return { title: t('title', { league: league.name }) };
}

export default async function FixturesPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const league = findLeague(slug);
  if (!league) notFound();
  const t = await getTranslations('fixtures');

  const requested = (await searchParams).month;
  const current = (await viewerToday()).slice(0, 7);
  const month = requested && isIsoMonth(requested) ? requested : current;
  const { from, to } = monthBounds(month);
  const matches = await safe(getProvider().getMatches(league.slug, { dateFrom: from, dateTo: to }));

  // "LLLL" style: the standalone month name, which matters for Russian ("сентябрь", not "сентября").
  const tag = LOCALE_TAGS[locale];
  const monthName = (m: string) =>
    capitalise(new Intl.DateTimeFormat(tag, { month: 'long', timeZone: 'UTC' }).format(at(m)));
  const title = `${monthName(month)} ${at(month).getUTCFullYear()}`;

  const href = (m: string) => `/tables/${league.slug}/fixtures?month=${m}`;
  const prev = shiftIsoMonth(month, -1);
  const next = shiftIsoMonth(month, 1);
  const cell = 'px-4 py-[9px] text-sm hover:bg-hover';

  return (
    <section>
      <BackLink href={`/tables/${league.slug}`} label={t('back', { league: league.name })} />
      <PageHeader
        kicker={t('kicker', { league: league.name })}
        title={title}
        aside={
          <nav aria-label={t('monthNav')} className="flex items-stretch border">
            <Link href={href(prev)} rel="prev" className={`${cell} border-r`}>
              ‹ {monthName(prev)}
            </Link>
            {month !== current && (
              <Link href={`/tables/${league.slug}/fixtures`} className={`${cell} border-r`}>
                {t('thisMonth')}
              </Link>
            )}
            <Link href={href(next)} rel="next" className={cell}>
              {monthName(next)} ›
            </Link>
          </nav>
        }
      />

      {!matches ? (
        <DataNotice kind="fixtures" />
      ) : matches.length === 0 ? (
        <p className="py-12 text-[17px] text-ink-2">{t('none', { league: league.name })}</p>
      ) : (
        <div className="max-w-[760px] pt-8">
          {groupMatchesByDate(matches).map((group) => (
            <section key={group.date} className="mb-9">
              <h2 className="pb-2.5 eyebrow">
                <LocalTime iso={group.matches[0]!.kickoff} mode="date" />
              </h2>
              <div className="rule-2" />
              {group.matches.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
