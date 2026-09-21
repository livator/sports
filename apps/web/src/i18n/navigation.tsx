import { createNavigation } from 'next-intl/navigation';
import type { ComponentProps } from 'react';
import { routing } from './routing';

const navigation = createNavigation(routing);

/** Locale-aware replacements for next/navigation. Always import these in pages and components. */
export const { redirect, usePathname, useRouter, getPathname } = navigation;

/**
 * Locale-aware replacement for next/link, with prefetching off unless a link asks for it.
 *
 * Every page here is rendered per request from live data, so a prefetch brings back nothing
 * the next navigation can reuse. What it does do: a scoreboard has dozens of links on screen
 * (matches, clubs, headlines), each one fires a request, and the browser only keeps about six
 * connections per site. A click then queues behind them, which showed up as filter changes
 * that sometimes hung for seconds.
 */
export function Link({ prefetch = false, ...props }: ComponentProps<typeof navigation.Link>) {
  return <navigation.Link prefetch={prefetch} {...props} />;
}
