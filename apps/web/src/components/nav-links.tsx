'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
  flag?: string;
}

export function NavLinks({ items, className }: { items: NavItem[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn('items-center gap-1', className)} aria-label="Leagues">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition',
              active
                ? 'bg-surface-3 text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]'
                : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
            )}
          >
            {item.flag && <span aria-hidden>{item.flag}</span>}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
