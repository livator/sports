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
