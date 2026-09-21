'use client';

import {
  LEAGUES,
  latestResults,
  resultsLeagues,
  shiftIsoDate,
  toLocalIsoDate,
  type Match,
} from '@sports/core';
import { useMatchesAcross } from '@sports/query';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { competitionName } from '@/lib/competitions';
import { matchHref, scoreText, sideWeight, statusLabel, statusTone, toneClass } from '@/lib/view';

/** Narrowest a result may get, and the most shown at once, as in the design. */
const ITEM_MIN_WIDTH = 150;
const MAX_VISIBLE = 5;
/** Final scores only, from the top five leagues by default: see `latestResults`. */
const RESULT_SLUGS = resultsLeagues().map((l) => l.slug);
const REACH_BACK_DAYS = 7;
/** Six pages at full width. Older scores belong on the fixtures pages, not in a strip. */
const MAX_RESULTS = 30;

/** "20.09" in the viewer's own timezone. Only rendered after mount, so no server mismatch. */
function dayOf(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`;
}

function TickerItem({ match }: { match: Match }) {
  const ts = useTranslations('status');
  const tc = useTranslations('competitions');
  const league = LEAGUES.find((l) => l.slug === match.leagueSlug);
  return (
    <Link
      href={matchHref(match)}
      className="flex min-w-0 flex-col justify-center gap-0.5 border-r px-3 py-1.5 hover:bg-hover"
    >
      <span className="flex justify-between gap-2 tnum text-[10px] font-bold tracking-[0.06em] uppercase">
        <span className="truncate text-ink-3">
          {league ? competitionName(league, tc, true) : ''}
        </span>
        {/* Every item is a final score, and they reach back a week, so say which day. */}
        <span className={`flex-none ${toneClass[statusTone(match)]}`}>
          {statusLabel(match, ts)} · {dayOf(match.kickoff)}
        </span>
      </span>
      <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 text-xs">
        <span className={`truncate ${sideWeight(match, 'home')}`}>{match.homeTeam.tla}</span>
        <span className="tnum text-[13px] font-extrabold whitespace-nowrap">
          {scoreText(match)}
        </span>
        <span className={`truncate text-right ${sideWeight(match, 'away')}`}>
          {match.awayTeam.tla}
        </span>
      </span>
    </Link>
  );
}

/**
 * "Latest results" strip in the navigation: final scores of the past week from the top five
 * leagues, a page at a time. The design shows it from 1200px up; how many results fit is
 * measured from the strip itself, because the nav's other contents vary by language.
 */
export function ResultsTicker() {
  const t = useTranslations('nav');
  // The viewer's own calendar day. Unknown on the server, so the strip fills in after mount.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(toLocalIsoDate(new Date())), []);

  const track = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(MAX_VISIBLE);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () =>
      setVisible(Math.max(1, Math.min(MAX_VISIBLE, Math.floor(el.clientWidth / ITEM_MIN_WIDTH))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
    // The track is a different element once the date is known, so measure that one.
  }, [today]);

  return (
    <div
      role="group"
      aria-label={t('tickerLabel')}
      className="mx-2 hidden min-w-0 flex-1 items-stretch self-stretch border-x min-[1200px]:flex"
    >
      {today ? (
        <TickerPages today={today} visible={visible} trackRef={track} />
      ) : (
        <div ref={track} className="min-w-0 flex-1" />
      )}
    </div>
  );
}

function TickerPages({
  today,
  visible,
  trackRef,
}: {
  today: string;
  visible: number;
  trackRef: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations('nav');
  // A week back, so the strip still has something to show between match weekends.
  const range = useMemo(
    () => ({ dateFrom: shiftIsoDate(today, -REACH_BACK_DAYS), dateTo: today }),
    [today],
  );
  const recent = useMatchesAcross(RESULT_SLUGS, range);
  const results = useMemo(() => latestResults(recent.data).slice(0, MAX_RESULTS), [recent.data]);

  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(results.length / visible));
  const current = ((page % pages) + pages) % pages;
  const shown = results.slice(current * visible, current * visible + visible);
  const arrow = 'px-3 text-base hover:text-accent disabled:text-ink-3 disabled:hover:text-ink-3';

  return (
    <>
      <button
        type="button"
        aria-label={t('tickerPrev')}
        className={`border-r ${arrow}`}
        disabled={pages < 2}
        onClick={() => setPage(current - 1)}
      >
        ‹
      </button>
      <div
        ref={trackRef}
        className="grid min-w-0 flex-1 auto-cols-[minmax(150px,1fr)] grid-flow-col overflow-hidden"
      >
        {shown.map((match) => (
          <TickerItem key={`${match.leagueSlug}:${match.id}`} match={match} />
        ))}
      </div>
      <button
        type="button"
        aria-label={t('tickerNext')}
        className={arrow}
        disabled={pages < 2}
        onClick={() => setPage(current + 1)}
      >
        ›
      </button>
    </>
  );
}
