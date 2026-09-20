import { isLive, zoneForPosition, type League, type LeagueSlug, type Match } from '@sports/core';

/** Presentation helpers shared by server and client components. No React in here. */

export type StatusTone = 'live' | 'done' | 'upcoming';

export function statusTone(match: Match): StatusTone {
  if (isLive(match.status)) return 'live';
  return match.status === 'scheduled' ? 'upcoming' : 'done';
}

export const toneClass: Record<StatusTone, string> = {
  live: 'text-accent',
  done: 'text-ink-3',
  upcoming: 'text-ink',
};

type StatusKey = 'ft' | 'ht' | 'live' | 'postponed' | 'cancelled';

/**
 * Short status for a started or called-off match: a running clock, or a translated code.
 * Scheduled matches show a local kick-off time instead, so they have no label here.
 */
export function statusLabel(match: Match, t: (key: StatusKey) => string): string {
  switch (match.status) {
    case 'live':
      return match.displayClock ?? (match.minute !== undefined ? `${match.minute}'` : t('live'));
    case 'paused':
      return t('ht');
    case 'finished':
      return t('ft');
    case 'postponed':
      return t('postponed');
    case 'cancelled':
      return t('cancelled');
    default:
      return '';
  }
}

export function scoreText(match: Match): string {
  const { home, away } = match.score;
  return home === null || away === null ? '–' : `${home} – ${away}`;
}

/** Font weight for a side: the loser of a finished match is set lighter. */
export function sideWeight(match: Match, side: 'home' | 'away'): string {
  const { home, away } = match.score;
  if (match.status !== 'finished' || home === null || away === null) return 'font-semibold';
  const lost = side === 'home' ? home < away : away < home;
  return lost ? 'font-normal' : 'font-semibold';
}

/* Paths are locale-free: the i18n <Link> adds "/ru" or "/ro" when needed. */
export const matchHref = (m: Pick<Match, 'leagueSlug' | 'id'>) => `/match/${m.leagueSlug}/${m.id}`;
export const teamHref = (league: LeagueSlug, teamId: string) => `/team/${league}/${teamId}`;
export const playerHref = (league: LeagueSlug, playerId: string) => `/player/${league}/${playerId}`;

/** Link to the scoreboard for a day and league filter, keeping the URL clean for defaults. */
export function homeHref(opts: {
  date: string;
  today: string;
  league: LeagueSlug | 'all';
}): string {
  const params = new URLSearchParams();
  if (opts.date !== opts.today) params.set('date', opts.date);
  if (opts.league !== 'all') params.set('league', opts.league);
  const query = params.toString();
  return query ? `/?${query}` : '/';
}

/** Left-edge colour for a table position: accent for the Champions League, ink for other Europe, grey for the drop. */
export function zoneEdgeClass(league: League, position: number): string {
  switch (zoneForPosition(league, position)) {
    case 'champions-league':
      return 'border-l-accent';
    case 'europa-league':
    case 'conference-league':
      return 'border-l-ink';
    case 'relegation':
    case 'relegation-playoff':
      return 'border-l-neutral-400';
    default:
      return 'border-l-transparent';
  }
}

export function seasonLabelFor(date: Date): string {
  const year = date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
}

/** 20.09.2026 */
export function dotted(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
