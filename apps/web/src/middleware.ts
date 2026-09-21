import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { clientAddress, LIMITS, take } from './lib/rate-limit';

const withLocale = createMiddleware(routing);

/** API routes and the admin console have no locale prefix; everything else does. */
const UNLOCALISED = /^\/(api|admin)(\/|$)/;

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');
  const writes = request.method !== 'GET' && request.method !== 'HEAD';
  const bucket = writes ? 'apiWrite' : isApi ? 'apiRead' : 'page';

  const verdict = take(`${bucket}:${clientAddress(request.headers)}`, LIMITS[bucket]);
  if (!verdict.allowed) {
    const headers = { 'Retry-After': String(verdict.retryAfter), 'Cache-Control': 'no-store' };
    return isApi
      ? NextResponse.json({ error: 'Too many requests' }, { status: 429, headers })
      : new NextResponse('Too many requests. Try again in a minute.', { status: 429, headers });
  }

  return UNLOCALISED.test(pathname) ? NextResponse.next() : withLocale(request);
}

export const config = {
  // Everything except Next internals and files with an extension (which covers /uploads/*).
  matcher: '/((?!_next|_vercel|.*\\..*).*)',
};
