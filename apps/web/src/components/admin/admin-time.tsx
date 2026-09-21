'use client';

import { useEffect, useState } from 'react';
import { formatDay, formatDayTime, formatDaysAgo } from '@/lib/admin-format';

const FORMATS = { day: formatDay, dayTime: formatDayTime, ago: formatDaysAgo } as const;

/**
 * A timestamp in the viewer's own timezone. The server does not know that zone, so the text
 * is filled in after mount instead of risking a wrong day around midnight.
 */
export function AdminTime({ iso, mode = 'day' }: { iso: string; mode?: keyof typeof FORMATS }) {
  const [text, setText] = useState('');
  useEffect(() => setText(FORMATS[mode](new Date(iso))), [iso, mode]);
  return (
    <time dateTime={iso} className="tnum">
      {text || ' '}
    </time>
  );
}
