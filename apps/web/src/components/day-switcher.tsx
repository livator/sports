import { shiftIsoDate } from '@sports/core';
import { LOCALE_TAGS, type Locale } from '@sports/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { dotted, homeHref } from '@/lib/view';

const at = (date: string) => new Date(`${date}T12:00:00Z`);

/** Relative name when the day is near today, otherwise the weekday in the selected language. */
export function dayLabel(
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

/**
 * Boxed three-day switch with arrows. It shows Yesterday / Today / Tomorrow while the
 * selected day is one of those, and slides to the selected day's neighbours otherwise.
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
  const locale = useLocale();
  const nearToday = Math.abs(at(date).getTime() - at(today).getTime()) <= 86_400_000;
  const centre = nearToday ? today : date;
  const days = [shiftIsoDate(centre, -1), centre, shiftIsoDate(centre, 1)];
  const href = (d: string) => homeHref({ date: d, today, league });
  const arrow = 'grid place-items-center px-2.5 text-base hover:bg-hover sm:px-3.5';

  return (
    <nav aria-label={t('nav')} className="flex w-full items-stretch border sm:w-auto">
      <Link
        href={href(shiftIsoDate(date, -1))}
        rel="prev"
        aria-label={t('previous')}
        className={`${arrow} border-r`}
      >
        ‹
      </Link>
      {days.map((d) => {
        const active = d === date;
        return (
          <Link
            key={d}
            href={href(d)}
            aria-current={active ? 'page' : undefined}
            className={`flex-1 border-r px-1.5 py-[9px] text-center tnum text-[13px] sm:flex-none sm:px-4 sm:text-sm ${
              active ? 'bg-accent font-bold text-ground' : 'hover:bg-hover'
            }`}
          >
            <span className="block">{dotted(d)}</span>
            <span className="block text-[11px] tracking-[0.06em] uppercase opacity-80">
              {dayLabel(d, today, locale, t)}
            </span>
          </Link>
        );
      })}
      <Link href={href(shiftIsoDate(date, 1))} rel="next" aria-label={t('next')} className={arrow}>
        ›
      </Link>
    </nav>
  );
}
