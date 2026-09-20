'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Re-renders the current server page on an interval. Mount it only while a match is live. */
export function LiveRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
