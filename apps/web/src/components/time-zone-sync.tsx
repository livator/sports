'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const COOKIE = 'tz';

/**
 * Tells the server which timezone the viewer is in, through a cookie. On a first visit (or
 * after travelling) the cookie is written and the page re-renders once with the right "today".
 */
export function TimeZoneSync() {
  const router = useRouter();
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;
    const current = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    if (current && decodeURIComponent(current) === zone) return;
    document.cookie = `${COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);
  return null;
}
