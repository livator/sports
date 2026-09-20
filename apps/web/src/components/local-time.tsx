'use client';

import { formatKickoffDate, formatKickoffTime } from '@sports/core';
import { useEffect, useState } from 'react';

/**
 * Renders a kickoff in the viewer's timezone. The server renders UTC; the client
 * re-formats after hydration so we never hit a hydration mismatch.
 */
export function LocalTime({ iso, mode = 'time' }: { iso: string; mode?: 'time' | 'date' }) {
  const fmt = mode === 'time' ? formatKickoffTime : formatKickoffDate;
  const [label, setLabel] = useState(() => fmt(iso, 'en-GB', 'UTC'));
  useEffect(() => {
    setLabel(fmt(iso, navigator.language || 'en-GB'));
  }, [iso, fmt]);
  return (
    <time dateTime={iso} className="tabular">
      {label}
    </time>
  );
}
