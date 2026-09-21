'use client';

import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { usePendingLink, usePendingNav } from './pending-nav';

/**
 * One headline in a news list. Beside an open article the list works like a picker: the
 * clicked story is marked at once, before the server has sent it, and the article it
 * replaces dims meanwhile. A new story starts at the top of the page.
 */
export function NewsLink({
  articleId,
  active,
  thumbnailUrl,
  children,
}: {
  articleId: string;
  active: boolean;
  /** A photo to show beside the text. Null keeps the slot, so a list stays aligned. */
  thumbnailUrl?: string | null;
  children: ReactNode;
}) {
  const href = `/news/${articleId}`;
  const { pendingHref } = usePendingNav();
  const onClick = usePendingLink(href, active, { scroll: true });
  // While another story is on its way, that one is the marked one.
  const heading = pendingHref?.startsWith('/news/') ? pendingHref === href : active;
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={heading ? 'page' : undefined}
      className={`border-b border-l-2 py-3 pr-1 pl-2.5 hover:bg-hover ${
        thumbnailUrl === undefined
          ? 'block'
          : 'grid grid-cols-[112px_minmax(0,1fr)] items-start gap-3.5'
      } ${heading ? 'border-l-accent bg-hover' : 'border-l-transparent'}`}
    >
      {thumbnailUrl !== undefined &&
        (thumbnailUrl ? (
          // A plain <img>, like the article photo: publisher CDNs vary too much for an allow-list.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            className="aspect-[3/2] w-full bg-neutral-300 object-cover contrast-[1.08] grayscale"
          />
        ) : (
          <span aria-hidden className="block aspect-[3/2] w-full bg-neutral-300" />
        ))}
      <span className="block min-w-0">{children}</span>
    </Link>
  );
}
