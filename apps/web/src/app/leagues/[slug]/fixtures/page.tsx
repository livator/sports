import { findLeague } from '@sports/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MatchList } from '@/components/match-list';
import { SectionHeading } from '@/components/section-heading';
import { getProvider } from '@/lib/provider';
import { cn } from '@/lib/utils';

export const revalidate = 60;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ matchday?: string }>;
};

export default async function FixturesPage({ params, searchParams }: Props) {
  const league = findLeague((await params).slug);
  if (!league) notFound();

  const provider = getProvider();
  const season = await provider.getSeason(league.slug);
  const requested = Number.parseInt((await searchParams).matchday ?? '', 10);
  const matchday = Number.isNaN(requested)
    ? season.currentMatchday
    : Math.min(Math.max(1, requested), season.totalMatchdays);
  const matches = await provider.getMatches(league.slug, { matchday });

  const href = (md: number) => `/leagues/${league.slug}/fixtures?matchday=${md}`;

  return (
    <section>
      <SectionHeading
        eyebrow="Fixtures & results"
        title={`Matchday ${matchday}`}
        action={
          <div className="flex items-center gap-1">
            <NavButton href={href(matchday - 1)} disabled={matchday <= 1} label="Previous matchday">
              <ChevronLeft className="size-4" />
            </NavButton>
            {matchday !== season.currentMatchday && (
              <Link
                href={href(season.currentMatchday)}
                className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:text-ink"
              >
                Current
              </Link>
            )}
            <NavButton
              href={href(matchday + 1)}
              disabled={matchday >= season.totalMatchdays}
              label="Next matchday"
            >
              <ChevronRight className="size-4" />
            </NavButton>
          </div>
        }
      />
      <MatchList matches={matches} emptyText="No fixtures scheduled for this matchday." />
    </section>
  );
}

function NavButton({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className = cn(
    'inline-flex size-9 items-center justify-center rounded-full border border-line transition',
    disabled ? 'cursor-not-allowed opacity-30' : 'hover:border-line-strong hover:bg-surface-2',
  );
  if (disabled) {
    return (
      <span className={className} aria-disabled aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} aria-label={label}>
      {children}
    </Link>
  );
}
