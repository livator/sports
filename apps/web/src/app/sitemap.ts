import { LEAGUES } from '@sports/core';
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.appUrl;
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    ...LEAGUES.flatMap((l) => [
      {
        url: `${base}/leagues/${l.slug}`,
        lastModified: now,
        changeFrequency: 'hourly' as const,
        priority: 0.9,
      },
      {
        url: `${base}/leagues/${l.slug}/fixtures`,
        lastModified: now,
        changeFrequency: 'hourly' as const,
        priority: 0.8,
      },
      {
        url: `${base}/leagues/${l.slug}/scorers`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      },
    ]),
  ];
}
