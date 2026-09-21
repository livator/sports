'use client';

import { useEffect } from 'react';

/** Tells the server one of our own articles was opened, once per browser session. */
export function ViewBeacon({ articleId }: { articleId: string }) {
  useEffect(() => {
    const key = `pitchside.viewed.${articleId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Storage blocked: count the view anyway rather than never.
    }
    void fetch(`/api/v1/news/${encodeURIComponent(articleId)}/view`, {
      method: 'POST',
      keepalive: true,
    }).catch(() => undefined);
  }, [articleId]);
  return null;
}
