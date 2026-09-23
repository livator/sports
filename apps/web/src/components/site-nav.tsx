'use client';

import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { initialsOf } from '@/lib/view';
import { useAuthUi, useSessionUser } from './auth-dialog';
import { LanguageSwitch } from './language-switch';
import { ResultsTicker } from './results-ticker';

const LINKS = [
  { href: '/', key: 'matches', match: (p: string) => p === '/' || p.startsWith('/match') },
  {
    href: '/tables',
    key: 'tables',
    match: (p: string) => p.startsWith('/tables') || p.startsWith('/team'),
  },
  { href: '/players', key: 'players', match: (p: string) => p.startsWith('/player') },
  { href: '/news', key: 'news', match: (p: string) => p.startsWith('/news') },
] as const;

export function SiteNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { user, isPending } = useSessionUser();
  const { openAuth, openAccount } = useAuthUi();

  return (
    <nav
      aria-label={t('label')}
      className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b-2 bg-ground px-[clamp(16px,4vw,48px)] py-3 sm:flex-nowrap sm:gap-x-4"
    >
      <Link href="/" className="mr-auto flex items-center gap-2.5 text-lg font-extrabold">
        <span aria-hidden className="inline-block size-3 bg-accent" />
        Pitchside
      </Link>
      <ResultsTicker />
      {/* On phones the section links drop to their own row so every language fits. */}
      <div className="order-last flex w-full gap-5 sm:order-none sm:w-auto sm:gap-4">
        {LINKS.map((link) => {
          const active = link.match(pathname);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`text-sm hover:text-accent ${active ? 'text-accent' : ''}`}
            >
              {t(link.key)}
            </Link>
          );
        })}
      </div>
      <Suspense fallback={null}>
        <LanguageSwitch />
      </Suspense>
      {user ? (
        <button type="button" className="btn btn-secondary gap-2.5" onClick={openAccount}>
          <span className="grid size-[22px] place-items-center bg-ink text-[11px] text-ground">
            {initialsOf(user.name)}
          </span>
          <span className="hidden max-w-32 truncate md:inline">{user.name}</span>
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => openAuth()}
          // Avoid flashing "Sign in" at someone who is signed in while the session loads.
          style={isPending ? { visibility: 'hidden' } : undefined}
        >
          {t('signIn')}
        </button>
      )}
    </nav>
  );
}
