import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV !== 'production';

/**
 * What a page may load and do. Scripts and styles stay at 'unsafe-inline' because Next.js
 * inlines its bootstrap data and styles; tightening that needs per-request nonces, which would
 * make every page dynamic. The rest is strict: nothing may frame the site (clickjacking),
 * forms and <base> cannot be pointed elsewhere, no plugins, and scripts cannot call out to
 * other hosts. Images may come from any https host: article photos are pasted addresses.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Browsers only honour this over https, so it is harmless on http://localhost.
  ...(isDev
    ? []
    : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No need to tell visitors which framework and version to look up exploits for.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Lets a verification build run beside `next dev` without sharing (and wrecking) its .next:
  //   NEXT_DIST_DIR=.next-verify npx next build
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  transpilePackages: ['@sports/core', '@sports/query', '@sports/i18n'],
  // Native bindings: load at runtime instead of bundling.
  serverExternalPackages: ['@libsql/client', 'libsql'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'crests.football-data.org' },
      // Crests, league logos, player photos and venue images for api-football.
      { protocol: 'https', hostname: 'media.api-sports.io' },
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
