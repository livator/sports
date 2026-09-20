import { LEAGUES } from '@sports/core';
import Link from 'next/link';
import { Logo } from './logo';
import { NavLinks } from './nav-links';

export function SiteHeader({ demo }: { demo: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight"
        >
          <Logo className="size-7" />
          <span>Pitchside</span>
        </Link>

        <NavLinks
          className="hidden md:flex"
          items={LEAGUES.map((l) => ({ href: `/leagues/${l.slug}`, label: l.name, flag: l.flag }))}
        />

        <div className="ml-auto flex items-center gap-3">
          {demo && (
            <span
              title="Set FOOTBALL_DATA_API_KEY to use live data"
              className="hidden rounded-full border border-line-strong bg-surface-2 px-2.5 py-1 text-[11px] font-medium tracking-wide text-ink-muted uppercase sm:inline-flex"
            >
              Demo data
            </span>
          )}
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-muted transition hover:border-line-strong hover:text-ink"
          >
            GitHub
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-2 sm:px-6 md:hidden">
        <NavLinks
          className="-mx-1 scrollbar-none flex overflow-x-auto"
          items={LEAGUES.map((l) => ({ href: `/leagues/${l.slug}`, label: l.name, flag: l.flag }))}
        />
      </div>
    </header>
  );
}
