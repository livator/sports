'use client';

import { formatKickoffDate, formatKickoffTime } from '@sports/core';
import { LOCALE_TAGS } from '@sports/i18n';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';

/**
 * Renders a kick-off in the viewer's timezone and the selected language. The server renders
 * UTC; the client re-formats after hydration, so there is never a hydration mismatch.
 */
export function LocalTime({ iso, mode = 'time' }: { iso: string; mode?: 'time' | 'date' }) {
  const tag = LOCALE_TAGS[useLocale()];
  const fmt = mode === 'time' ? formatKickoffTime : formatKickoffDate;
  const [label, setLabel] = useState(() => fmt(iso, tag, 'UTC'));
  useEffect(() => {
    setLabel(fmt(iso, tag));
  }, [iso, fmt, tag]);
  return (
    <time dateTime={iso} className="tnum">
      {label}
    </time>
  );
}
