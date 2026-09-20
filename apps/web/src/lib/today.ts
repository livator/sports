import 'server-only';

import { toIsoDate } from '@sports/core';
import { cookies } from 'next/headers';

/** Set by <TimeZoneSync /> in the browser. Holds an IANA zone such as "Europe/Bucharest". */
export const TZ_COOKIE = 'tz';

/** Today's ISO date in a timezone. Falls back to UTC for a missing or invalid zone. */
export function todayIn(timeZone: string | undefined, now = new Date()): string {
  if (timeZone) {
    try {
      // en-CA formats as YYYY-MM-DD.
      return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
    } catch {
      // Unknown zone name: fall through to UTC.
    }
  }
  return toIsoDate(now);
}

/**
 * "Today" as the viewer sees it. Just after midnight in Bucharest it is already tomorrow
 * there while the server's UTC clock still says yesterday, which would mislabel the days.
 */
export async function viewerToday(): Promise<string> {
  return todayIn((await cookies()).get(TZ_COOKIE)?.value);
}
