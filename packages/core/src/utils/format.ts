import type { Match, MatchStatus } from '../types';

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function isLive(status: MatchStatus): boolean {
  return status === 'live' || status === 'paused';
}

export function isFinished(status: MatchStatus): boolean {
  return status === 'finished';
}

export function formatKickoffTime(iso: string, locale = 'en-GB', timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}

export function formatKickoffDate(iso: string, locale = 'en-GB', timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}

/** Human readable status label, e.g. "FT", "45'", "HT", "20:45". */
export function matchStatusLabel(match: Match, locale?: string, timeZone?: string): string {
  switch (match.status) {
    case 'finished':
      return 'FT';
    case 'live':
      if (match.displayClock) return match.displayClock;
      return match.minute !== undefined ? `${match.minute}'` : 'LIVE';
    case 'paused':
      return 'HT';
    case 'postponed':
      return 'PPD';
    case 'cancelled':
      return 'CANC';
    default:
      return formatKickoffTime(match.kickoff, locale, timeZone);
  }
}

/** Groups matches by ISO date, preserving kickoff order. */
export function groupMatchesByDate(
  matches: readonly Match[],
): Array<{ date: string; matches: Match[] }> {
  const groups = new Map<string, Match[]>();
  for (const match of [...matches].sort((a, b) => a.kickoff.localeCompare(b.kickoff))) {
    const date = match.kickoff.slice(0, 10);
    const bucket = groups.get(date) ?? [];
    bucket.push(match);
    groups.set(date, bucket);
  }
  return [...groups.entries()].map(([date, matches]) => ({ date, matches }));
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** ISO date (YYYY-MM-DD) in the runtime's local timezone. Use on clients to decide what "today" is. */
export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function isIsoMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Shifts an ISO date by whole days. */
export function shiftIsoDate(date: string, days: number): string {
  return toIsoDate(addDays(new Date(`${date}T00:00:00Z`), days));
}

/** Shifts an ISO month (YYYY-MM) by whole months. */
export function shiftIsoMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return toIsoDate(new Date(Date.UTC(y, m - 1 + delta, 1))).slice(0, 7);
}

/** First and last ISO date of an ISO month. */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return { from: `${month}-01`, to: toIsoDate(new Date(Date.UTC(y, m, 0))) };
}

/** Every ISO month (YYYY-MM) touched by the inclusive date range. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let cursor = from.slice(0, 7);
  const last = to.slice(0, 7);
  while (cursor <= last && months.length < 120) {
    months.push(cursor);
    cursor = shiftIsoMonth(cursor, 1);
  }
  return months;
}
