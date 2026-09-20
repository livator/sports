import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

/** Accent kicker, large title, then the 2px rule every screen in the design opens with. */
export function PageHeader({
  kicker,
  title,
  aside,
}: {
  kicker: string;
  title: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-10 pb-5">
        <div className="min-w-0">
          <span className="mb-2.5 block kicker">{kicker}</span>
          <h1 className="display">{title}</h1>
        </div>
        {aside}
      </div>
      <div className="rule-2" />
    </>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="pt-6">
      <Link href={href} className="text-[13px] text-ink-2 hover:text-accent">
        ← {label}
      </Link>
    </div>
  );
}
