'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { initialsOf } from '@/lib/admin-format';
import { authClient } from '@/lib/auth-client';

const LINKS = [
  { href: '/admin', label: 'Overview', match: (p: string) => p === '/admin' },
  { href: '/admin/news', label: 'News', match: (p: string) => p.startsWith('/admin/news') },
  { href: '/admin/users', label: 'Users', match: (p: string) => p.startsWith('/admin/users') },
] as const;

export function AdminNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function signOut() {
    setLeaving(true);
    await authClient.signOut();
    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <nav
      aria-label="Admin"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 bg-ground px-[clamp(16px,4vw,48px)] py-3"
    >
      <Link href="/admin" className="mr-auto flex items-center gap-2.5 text-lg font-extrabold">
        <span aria-hidden className="inline-block size-3 bg-accent" />
        Pitchside
        <span className="tag tag-neutral ml-1.5 font-normal">Admin</span>
      </Link>
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`text-sm hover:text-accent ${active ? 'text-accent' : ''}`}
          >
            {link.label}
          </Link>
        );
      })}
      <a href="/" target="_blank" rel="noopener" className="text-sm text-ink-2 hover:text-accent">
        View site ↗
      </a>
      <button
        type="button"
        className="btn btn-secondary gap-2.5"
        onClick={signOut}
        disabled={leaving}
        title={userName}
      >
        <span className="grid size-[22px] place-items-center bg-ink text-[11px] text-ground">
          {initialsOf(userName)}
        </span>
        Sign out
      </button>
    </nav>
  );
}
