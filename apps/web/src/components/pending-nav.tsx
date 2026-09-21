'use client';

import { useSearchParams } from 'next/navigation';
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';

interface PendingNav {
  /** Where an in-flight filter navigation is heading, or null. */
  pendingHref: string | null;
  /** Null when there is no provider above: links must then navigate on their own. */
  navigate: ((href: string, options?: { scroll?: boolean }) => void) | null;
}

const Context = createContext<PendingNav>({ pendingHref: null, navigate: null });

/** If a navigation never lands (offline, server down), stop pretending after this long. */
const GIVE_UP_MS = 10_000;
/** On <html> while a navigation is pending; the stylesheet turns it into a "working" cursor. */
const BUSY_ATTRIBUTE = 'data-navigating';

/**
 * Tells the provider when the address has changed, which is when a navigation has landed.
 * On its own and behind Suspense because `useSearchParams` would otherwise opt every
 * statically rendered page under this provider out of static rendering.
 */
function UrlWatcher({ onChange }: { onChange: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(onChange, [pathname, search, onChange]);
  return null;
}

/**
 * Filter links (competition, tab, day) change the URL and wait for the server. This lets the
 * clicked link look selected at once and lets the page show that new content is on its way,
 * instead of sitting still until the response lands.
 *
 * The navigation itself is a plain `router.push`. Wrapping it in a transition of our own to
 * read its pending flag made some navigations never commit in production builds, so the
 * provider watches the address instead.
 */
export function PendingNavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const navigate = useCallback(
    (href: string, options: { scroll?: boolean } = {}) => {
      setPendingHref(href);
      // Filters change what is under the reader's eyes, so the page stays put by default.
      router.push(href, { scroll: options.scroll ?? false });
    },
    [router],
  );
  const landed = useCallback(() => setPendingHref(null), []);

  useEffect(() => {
    if (pendingHref === null) return;
    const timer = setTimeout(landed, GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [pendingHref, landed]);

  // The cursor says "working" for exactly as long as a navigation is on its way: set on the
  // click, cleared when the page has landed. No timer decides it, so a quick switch shows it
  // for a blink and a slow one for as long as the wait really is. See `[data-navigating]` in
  // globals.css.
  useEffect(() => {
    if (pendingHref === null) return;
    const root = document.documentElement;
    root.setAttribute(BUSY_ATTRIBUTE, '');
    return () => root.removeAttribute(BUSY_ATTRIBUTE);
  }, [pendingHref]);

  const value = useMemo(() => ({ pendingHref, navigate }), [pendingHref, navigate]);
  return (
    <Context.Provider value={value}>
      <Suspense fallback={null}>
        <UrlWatcher onChange={landed} />
      </Suspense>
      {children}
    </Context.Provider>
  );
}

export const usePendingNav = () => useContext(Context);

/**
 * Click handler for a link that should navigate through `navigate`. Leaves new-tab clicks
 * alone, and also a link to the page already showing: its address never changes, so nothing
 * would ever report that it had landed.
 */
export function usePendingLink(
  href: string,
  isCurrent: boolean,
  options: { scroll?: boolean } = {},
) {
  const { navigate } = usePendingNav();
  return (event: MouseEvent<HTMLAnchorElement>) => {
    // Without a provider this must stay an ordinary link. Cancelling the click and then
    // having nowhere to send it would leave a chip that does nothing at all.
    if (!navigate || isCurrent || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href, options);
  };
}

/** Content that is about to be replaced: dimmed and marked busy while a navigation is pending. */
export function PendingRegion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { pendingHref } = usePendingNav();
  const busy = pendingHref !== null;
  return (
    <div
      aria-busy={busy}
      className={`${className ?? ''} transition-opacity duration-150 ${busy ? 'opacity-50 delay-100' : ''}`}
    >
      {children}
    </div>
  );
}
