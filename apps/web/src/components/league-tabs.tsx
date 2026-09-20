'use client';

import type { LeagueSlug } from '@sports/core';
import { CalendarDays, Table2, Trophy } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function LeagueTabs({ slug, className }: { slug: LeagueSlug; className?: string }) {
  const pathname = usePathname();
  const base = `/leagues/${slug}`;
  const tabs = [
    { href: base, label: 'Standings', icon: Table2, exact: true },
    { href: `${base}/fixtures`, label: 'Fixtures', icon: CalendarDays, exact: false },
    { href: `${base}/scorers`, label: 'Top scorers', icon: Trophy, exact: false },
  ];

  return (
    <nav
      className={cn(
        'flex w-fit gap-1 rounded-full border border-line bg-surface/60 p-1',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition',
              active ? 'bg-pitch-500 text-black shadow' : 'text-ink-muted hover:text-ink',
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
