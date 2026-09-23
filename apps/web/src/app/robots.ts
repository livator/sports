import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

/** The base address is only known once the app is running, so this is not baked in at build. */
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin'] },
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
