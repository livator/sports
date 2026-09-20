'use client';

import { LEAGUES, isLive, type LeagueSlug, type Match } from '@sports/core';
import { useMatchesByDate } from '@sports/query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { matchHref, sideWeight, statusLabel, statusTone, toneClass } from '@/lib/view';
import { useFavourites } from './favourites';
import { LocalTime } from './local-time';
import { MatchRow } from './match-row';

const stripEdge = {
  live: 'border-t-accent',
  done: 'border-t-ink',
  upcoming: 'border-t-neutral-400',
};
const stripOrder = { live: 0, done: 1, upcoming: 2 };

/** Compact card for the horizontal strip: live first, then results, then fixtures. */
function StripCard({ match }: { match: Match }) {
  const ts = useTranslations('status');
  const tone = statusTone(match);
  const scheduled = match.status === 'scheduled';
  const league = LEAGUES.find((l) => l.slug === match.leagueSlug);
  return (
    <Link
      href={matchHref(match)}
      className={`flex w-[168px] flex-none flex-col gap-2 border-t-2 bg-surface px-3 py-2.5 hover:bg-neutral-300 ${stripEdge[tone]}`}
    >
      <span className="flex justify-between gap-2 tnum text-[11px] font-bold tracking-[0.06em] uppercase">
        <span className={`truncate ${toneClass[tone]}`}>
          {scheduled ? <LocalTime iso={match.kickoff} /> : statusLabel(match, ts)}
        </span>
        <span className="flex-none text-ink-3">{league?.shortName}</span>
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
      <div className="flex items-baseline justify-between pb-2.5">
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
        {meta && <span className="text-xs text-ink-3">{meta}</span>}
      </div>
      <div className="rule-2" />
      {matches.map((m) => (
        <MatchRow key={m.id} match={m} />
      ))}
    </section>
  );
}

/**
 * The day's matches: strip, league chips, then matches grouped by league with the
 * viewer's clubs pinned first. Server-rendered from `initialMatches`, then kept live.
 */
export function Scoreboard({
  date,
  league,
  initialMatches,
  chips,
  aside,
}: {
  date: string;
  league: LeagueSlug | 'all';
  initialMatches: Match[] | null;
  chips: ReactNode;
  aside: ReactNode;
}) {
  const t = useTranslations('home');
  const { favs } = useFavourites();
  const { data, isError } = useMatchesByDate(
    date,
    initialMatches ? { initialData: initialMatches } : {},
  );

  const all = data ?? [];
  const liveCount = all.filter((m) => isLive(m.status)).length;
  const filtered = league === 'all' ? all : all.filter((m) => m.leagueSlug === league);
  const favIds = new Set(favs.map((f) => f.id));
  const mine = filtered.filter((m) => favIds.has(m.homeTeam.id) || favIds.has(m.awayTeam.id));
  const mineIds = new Set(mine.map((m) => m.id));
  const strip = [...all].sort(
    (a, b) =>
      stripOrder[statusTone(a)] - stripOrder[statusTone(b)] || a.kickoff.localeCompare(b.kickoff),
  );

  return (
    <>
      {strip.length > 0 && (
        <div className="scrollbar-none flex gap-3 overflow-x-auto border-b pt-4 pb-3.5">
          {strip.map((m) => (
            <StripCard key={m.id} match={m} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 border-b py-3.5">
        {chips}
        <div className="flex items-center gap-2 tnum text-[13px] text-ink-2">
          {liveCount > 0 && <span aria-hidden className="size-2 animate-pulse-live bg-accent" />}
          {liveCount > 0
            ? t('liveNow', { live: liveCount, count: all.length })
            : t('matchCount', { count: all.length })}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-14 gap-y-10 pt-8">
        <div className="min-w-0 flex-[1_1_560px]">
          {!data ? (
            <p className="py-12 text-[17px] text-ink-2">{isError ? t('feedDown') : t('loading')}</p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-[17px] text-ink-2">
              {league === 'all' ? t('noMatchesAll') : t('noMatchesLeague')}
            </p>
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
                    title={l.name}
                    href={`/tables/${l.slug}`}
                    meta={t('matchCount', { count: matches.length })}
                    matches={matches}
                  />
                );
              })}
            </>
          )}
        </div>
        {aside}
      </div>
    </>
  );
}
