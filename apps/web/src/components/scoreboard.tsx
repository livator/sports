'use client';

import { LEAGUES, isLive, type LeagueSlug, type Match } from '@sports/core';
import { useMatchesByDate, usePrefetchMatchesByDate } from '@sports/query';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { competitionName, parseSelection, selectionSlugs } from '@/lib/competitions';
import { matchHref, sideWeight, statusLabel, statusTone, toneClass } from '@/lib/view';
import { useFavourites } from './favourites';
import { LocalTime } from './local-time';
import { MatchRow } from './match-row';
import { daysAround } from './day-switcher';
import { PendingRegion, usePendingNav } from './pending-nav';

const stripEdge = {
  live: 'border-t-accent',
  done: 'border-t-ink',
  upcoming: 'border-t-neutral-400',
};
const stripOrder = { live: 0, done: 1, upcoming: 2 };

type Scope = 'all' | 'category' | 'league';

/**
 * What a clicked competition chip or day is heading for. Every match of the day is already in
 * the browser, and the neighbouring days are loaded ahead of time, so the list can follow the
 * click at once and leave only the table and the news to the server.
 */
function useHeadingFilter(today: string): {
  slugs: LeagueSlug[] | null;
  scope: Scope;
  /** The day being headed for, when the click changes the day. */
  date: string | null;
} | null {
  const { pendingHref } = usePendingNav();
  const current = useSearchParams();
  if (pendingHref === null) return null;
  const target = new URL(pendingHref, 'http://local');
  if (target.pathname !== '/') return null;
  const selection = parseSelection(target.searchParams.get('league') ?? undefined, LEAGUES);
  const sameDay = target.searchParams.get('date') === current.get('date');
  return {
    slugs: selectionSlugs(selection, LEAGUES),
    scope: selection.kind,
    // No date in the address means today.
    date: sameDay ? null : (target.searchParams.get('date') ?? today),
  };
}

/** Compact card for the horizontal strip: live first, then results, then fixtures. */
function StripCard({ match }: { match: Match }) {
  const ts = useTranslations('status');
  const tc = useTranslations('competitions');
  const tone = statusTone(match);
  const scheduled = match.status === 'scheduled';
  const league = LEAGUES.find((l) => l.slug === match.leagueSlug);
  return (
    <Link
      href={matchHref(match)}
      className={`flex w-[168px] flex-none flex-col gap-2 border-t-2 bg-surface px-3 py-2.5 hover:bg-neutral-300 ${stripEdge[tone]}`}
    >
      <span className="flex justify-between gap-2 tnum text-[11px] font-bold tracking-[0.06em] uppercase">
        <span className={`flex-none ${toneClass[tone]}`}>
          {scheduled ? <LocalTime iso={match.kickoff} /> : statusLabel(match, ts)}
        </span>
        <span className="truncate text-ink-3">
          {league ? competitionName(league, tc, true) : ''}
        </span>
      </span>
      {(['home', 'away'] as const).map((side) => (
        <span
          key={side}
          className={`grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[13px] ${sideWeight(match, side)}`}
        >
          <span className="truncate">
            {(side === 'home' ? match.homeTeam : match.awayTeam).shortName}
          </span>
          <span className="tnum font-extrabold">{scheduled ? '' : (match.score[side] ?? '')}</span>
        </span>
      ))}
    </Link>
  );
}

function Group({
  title,
  href,
  meta,
  accent = false,
  matches,
}: {
  title: string;
  href?: string;
  meta?: string;
  accent?: boolean;
  matches: Match[];
}) {
  return (
    <section className="mb-9">
      <div className="flex items-baseline justify-between gap-3 pb-2.5">
        {accent ? (
          <h2 className="flex items-center gap-2.5 kicker font-normal">
            <span aria-hidden className="size-2.5 bg-accent" />
            {title}
          </h2>
        ) : (
          <h2 className="eyebrow">
            {href ? (
              <Link href={href} className="hover:text-accent">
                {title}
              </Link>
            ) : (
              title
            )}
          </h2>
        )}
        {meta && <span className="flex-none text-xs text-ink-3">{meta}</span>}
      </div>
      <div className="rule-2" />
      {matches.map((m) => (
        <MatchRow key={m.id} match={m} />
      ))}
    </section>
  );
}

/**
 * The day's matches: strip, competition picker, then matches grouped by competition with
 * the viewer's clubs pinned first. Server-rendered from `initialMatches`, then kept live.
 */
export function Scoreboard({
  date,
  today,
  slugs,
  scope,
  initialMatches,
  picker,
  aside,
}: {
  date: string;
  /** The viewer's own today, which is what an address without a date means. */
  today: string;
  /** Competitions to show, or null for all of them. */
  slugs: LeagueSlug[] | null;
  /** How wide the filter is, which picks the right "nothing on today" message. */
  scope: Scope;
  initialMatches: Match[] | null;
  picker: ReactNode;
  aside: ReactNode;
}) {
  const t = useTranslations('home');
  const tc = useTranslations('competitions');
  const { favs } = useFavourites();
  // What the server rendered, unless a chip or a day was just clicked: then what that is
  // heading for. The neighbouring days are loaded ahead of time, so a clicked day usually
  // shows its matches at once; if it is not there yet, the current list stays up meanwhile.
  const heading = useHeadingFilter(today);
  const view = heading ?? { slugs, scope };
  const shownDate = heading?.date ?? date;
  const { data, isError, isPlaceholderData } = useMatchesByDate(shownDate, {
    ...(shownDate === date && initialMatches ? { initialData: initialMatches } : {}),
    keepPrevious: true,
  });
  usePrefetchMatchesByDate(daysAround(date, today).filter((d) => d !== date));

  const all = data ?? [];
  const wanted = view.slugs ? new Set<string>(view.slugs) : null;
  const filtered = wanted ? all.filter((m) => wanted.has(m.leagueSlug)) : all;
  const liveCount = filtered.filter((m) => isLive(m.status)).length;
  const favIds = new Set(favs.map((f) => f.id));
  const mine = filtered.filter((m) => favIds.has(m.homeTeam.id) || favIds.has(m.awayTeam.id));
  const mineIds = new Set(mine.map((m) => m.id));
  // The strip always follows the filter, so picking "UEFA" shows only UEFA cards.
  const strip = [...filtered].sort(
    (a, b) =>
      stripOrder[statusTone(a)] - stripOrder[statusTone(b)] || a.kickoff.localeCompare(b.kickoff),
  );
  const empty =
    view.scope === 'all'
      ? t('noMatchesAll')
      : view.scope === 'category'
        ? t('noMatchesGroup')
        : t('noMatchesLeague');

  return (
    <>
      {strip.length > 0 && (
        <div className="scrollbar-none flex gap-3 overflow-x-auto border-b pt-4 pb-3.5">
          {strip.map((m) => (
            <StripCard key={m.id} match={m} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-x-6 gap-y-2 border-b py-3.5">
        {picker}
        <div className="flex items-center gap-2 py-1.5 tnum text-[13px] text-ink-2">
          {liveCount > 0 && <span aria-hidden className="size-2 animate-pulse-live bg-accent" />}
          {liveCount > 0
            ? t('liveNow', { live: liveCount, count: filtered.length })
            : t('matchCount', { count: filtered.length })}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-14 gap-y-10 pt-8">
        {/* 480 rather than the design's 560: with the news sidebar, 560 pushes the table below the matches at 1280px. */}
        <div
          className={`min-w-0 flex-[1_1_480px] transition-opacity ${isPlaceholderData ? 'opacity-50' : ''}`}
          aria-busy={isPlaceholderData}
        >
          {!data ? (
            <p className="py-12 text-[17px] text-ink-2">{isError ? t('feedDown') : t('loading')}</p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-[17px] text-ink-2">{empty}</p>
          ) : (
            <>
              {mine.length > 0 && <Group title={t('yourClubs')} accent matches={mine} />}
              {LEAGUES.map((l) => {
                const matches = filtered.filter(
                  (m) => m.leagueSlug === l.slug && !mineIds.has(m.id),
                );
                if (matches.length === 0) return null;
                return (
                  <Group
                    key={l.slug}
                    title={competitionName(l, tc)}
                    {...(l.hasTable ? { href: `/tables/${l.slug}` } : {})}
                    meta={t('matchCount', { count: matches.length })}
                    matches={matches}
                  />
                );
              })}
            </>
          )}
        </div>
        <PendingRegion className="max-w-[420px] min-w-0 flex-[1_1_300px]">{aside}</PendingRegion>
      </div>
    </>
  );
}
