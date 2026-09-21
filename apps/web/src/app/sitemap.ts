import { LEAGUES } from '@sports/core';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@sports/i18n';
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

/** English is unprefixed; other languages live under "/ru" and "/ro". */
const localized = (path: string, locale: Locale) =>
  `${env.appUrl}${locale === DEFAULT_LOCALE ? '' : `/${locale}`}${path === '/' ? '' : path}` ||
  env.appUrl;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: Array<{ path: string; priority: number; daily?: boolean }> = [
    { path: '/', priority: 1 },
    { path: '/players', priority: 0.7, daily: true },
    ...LEAGUES.flatMap((l) => [
      // Friendlies have fixtures but no table.
      ...(l.hasTable
        ? [{ path: `/tables/${l.slug}`, priority: l.category === 'more' ? 0.7 : 0.9 }]
        : []),
      { path: `/tables/${l.slug}/fixtures`, priority: l.category === 'more' ? 0.6 : 0.8 },
    ]),
  ];

  return pages.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: localized(page.path, locale),
      lastModified: now,
      changeFrequency: page.daily ? ('daily' as const) : ('hourly' as const),
      priority: page.priority,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((l) => [l, localized(page.path, l)])),
      },
    })),
  );
}
