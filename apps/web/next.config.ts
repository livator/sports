import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a verification build run beside `next dev` without sharing (and wrecking) its .next:
  //   NEXT_DIST_DIR=.next-verify npx next build
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  transpilePackages: ['@sports/core', '@sports/query', '@sports/i18n'],
  // Native bindings: load at runtime instead of bundling.
  serverExternalPackages: ['@libsql/client', 'libsql'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'a.espncdn.com' },
      { protocol: 'https', hostname: 'crests.football-data.org' },
    ],
    // Crests never change at a given URL; keep optimised copies for a month.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  // The first version of the site had one section per league.
  async redirects() {
    return [
      { source: '/leagues/:slug', destination: '/tables/:slug', permanent: true },
      { source: '/leagues/:slug/fixtures', destination: '/tables/:slug/fixtures', permanent: true },
      { source: '/leagues/:slug/scorers', destination: '/players?league=:slug', permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
