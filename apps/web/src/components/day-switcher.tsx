'use client';

import { shiftIsoDate } from '@sports/core';
import { LOCALE_TAGS, type Locale } from '@sports/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { dotted, homeHref } from '@/lib/view';
import { usePendingLink, usePendingNav } from './pending-nav';

const at = (date: string) => new Date(`${date}T12:00:00Z`);

/** Relative name when the day is near today, otherwise the weekday in the selected language. */
function dayLabel(
  date: string,
  today: string,
  locale: Locale,
  t: (key: 'today' | 'yesterday' | 'tomorrow') => string,
): string {
  if (date === today) return t('today');
  if (date === shiftIsoDate(today, -1)) return t('yesterday');
  if (date === shiftIsoDate(today, 1)) return t('tomorrow');
  const name = new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(at(date));
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** The day a pending navigation is heading for, when it is a day of the scoreboard. */
export function useHeadingDate(today: string): string | null {
  const { pendingHref } = usePendingNav();
  if (pendingHref === null) return null;
  const target = new URL(pendingHref, 'http://local');
  return target.pathname === '/' ? (target.searchParams.get('date') ?? today) : null;
}

/** The days the switcher offers for a selected day: the three boxes and the two arrows. */
export function daysAround(date: string, today: string): string[] {
  const nearToday = Math.abs(at(date).getTime() - at(today).getTime()) <= 86_400_000;
  const centre = nearToday ? today : date;
  return [
    ...new Set([
      shiftIsoDate(centre, -1),
      centre,
      shiftIsoDate(centre, 1),
      shiftIsoDate(date, -1),
      shiftIsoDate(date, 1),
    ]),
  ];
}

function DayLink({
  href,
  className,
  children,
  current = false,
  active = current,
  ...rest
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  /** The page already shows this day, so a click changes nothing. */
  current?: boolean;
  /** Shown as selected. Defaults to `current`. */
  active?: boolean;
  rel?: string;
  'aria-label'?: string;
}) {
  const onClick = usePendingLink(href, current);
  return (
    <Link
      href={href}
      scroll={false}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={className}
      {...rest}
    >
      {children}
    </Link>
  );
}

/**
 * The scoreboard's heading: what kind of day it is, and the date. It follows a click on the
 * day switcher at once, like the switcher itself, instead of waiting for the server.
 */
export function DayHeading({ date, today }: { date: string; today: string }) {
  const t = useTranslations('home');
  const td = useTranslations('days');
  const locale = useLocale() as Locale;
  const shown = useHeadingDate(today) ?? date;
  const day = dayLabel(shown, today, locale, td);
  const kicker =
    shown === today
      ? t('kickerToday')
      : shown < today
        ? t('kickerPast', { day })
        : t('kickerFuture', { day });
  return (
    <div>
      <span className="mb-2.5 block kicker">{kicker}</span>
      <h1 className="display tnum" aria-label={t('heading', { date: dotted(shown) })}>
        {dotted(shown)}
      </h1>
    </div>
  );
}

/**
 * Boxed three-day switch with arrows. It shows Yesterday / Today / Tomorrow while the
 * selected day is one of those, and slides to the selected day's neighbours otherwise.
 * The clicked day is marked at once; the page catches up behind it.
 */
export function DaySwitcher({
  date,
  today,
  league,
}: {
  date: string;
  today: string;
  /** Competition slug or category key to keep while changing day. */
  league?: string | undefined;
}) {
  const t = useTranslations('days');
  const locale = useLocale() as Locale;
  const selected = useHeadingDate(today) ?? date;
  const nearToday = Math.abs(at(selected).getTime() - at(today).getTime()) <= 86_400_000;
  const centre = nearToday ? today : selected;
  const days = [shiftIsoDate(centre, -1), centre, shiftIsoDate(centre, 1)];
  const href = (d: string) => homeHref({ date: d, today, league });
  const arrow = 'grid place-items-center px-2.5 text-base hover:bg-hover sm:px-3.5';

  return (
    <nav aria-label={t('nav')} className="flex w-full items-stretch border sm:w-auto">
      <DayLink
        href={href(shiftIsoDate(selected, -1))}
        rel="prev"
        aria-label={t('previous')}
        className={`${arrow} border-r`}
      >
        ‹
      </DayLink>
      {days.map((d) => {
        const active = d === selected;
        return (
          <DayLink
            key={d}
            href={href(d)}
            // Only the day the server has actually rendered is "current": a click on it would
            // change nothing, so it is left to behave as an ordinary link.
            current={d === date && selected === date}
            active={active}
            className={`flex-1 border-r px-1.5 py-[9px] text-center tnum text-[13px] sm:flex-none sm:px-4 sm:text-sm ${
              active ? 'bg-accent font-bold text-ground' : 'hover:bg-hover'
            }`}
          >
            <span className="block">{dotted(d)}</span>
            <span className="block text-[11px] tracking-[0.06em] uppercase opacity-80">
              {dayLabel(d, today, locale, t)}
            </span>
          </DayLink>
        );
      })}
      <DayLink
        href={href(shiftIsoDate(selected, 1))}
        rel="next"
        aria-label={t('next')}
        className={arrow}
      >
        ›
      </DayLink>
    </nav>
  );
}
