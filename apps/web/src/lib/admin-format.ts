/** Formatting for the admin console. Pure functions, safe in client and server components. */

const pad = (n: number) => String(n).padStart(2, '0');

/** 21.09.2026, as in the design. Uses the clock of whoever runs it. */
export function formatDay(date: Date): string {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export function formatDayTime(date: Date): string {
  return `${formatDay(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "Today", "Yesterday" or "12 days ago", by calendar day. */
export function formatDaysAgo(date: Date, now = new Date()): string {
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(now) - midnight(date)) / 86_400_000);
  if (days <= 0) return 'Today';
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Value for <input type="datetime-local"> in the viewer's own timezone. */
export function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
