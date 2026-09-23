import { LEAGUES } from '@sports/core';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@sports/i18n';
import type { MetadataRoute } from 'next';
import { listArticleSitemapEntries } from '@/lib/articles';
import { env } from '@/lib/env';

/**
 * Built per request, not at build time: the article list comes from the database, and the base
 * address is only known once the app is running.
 */
export const dynamic = 'force-dynamic';

/** English is unprefixed; other languages live under "/ru" and "/ro". */
const localized = (path: string, locale: Locale) =>
  `${env.appUrl}${locale === DEFAULT_LOCALE ? '' : `/${locale}`}${path === '/' ? '' : path}`;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: Array<{
    path: string;
    priority: number;
    changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency'];
    lastModified?: Date;
  }> = [
    { path: '/', priority: 1 },
    { path: '/news', priority: 0.9, changeFrequency: 'daily' },
    { path: '/players', priority: 0.7, changeFrequency: 'daily' },
    ...LEAGUES.flatMap((l) => [
      // Friendlies have fixtures but no table.
      ...(l.hasTable
        ? [{ path: `/tables/${l.slug}`, priority: l.category === 'more' ? 0.7 : 0.9 }]
        : []),
      { path: `/tables/${l.slug}/fixtures`, priority: l.category === 'more' ? 0.6 : 0.8 },
    ]),
  ];

  // A database that is down must not take the whole sitemap with it.
  const articles = await listArticleSitemapEntries().catch((error) => {
    console.error('[sitemap]', error instanceof Error ? error.message : error);
    return [];
  });
  for (const { id, lastModified } of articles) {
    pages.push({ path: `/news/${id}`, priority: 0.6, changeFrequency: 'monthly', lastModified });
  }

  return pages.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: localized(page.path, locale),
      lastModified: page.lastModified ?? now,
      changeFrequency: page.changeFrequency ?? ('hourly' as const),
      priority: page.priority,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((l) => [l, localized(page.path, l)])),
      },
    })),
  );
}
