import { LEAGUES, findLeague } from '@sports/core';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LeagueTabs } from '@/components/league-tabs';
import { getProvider } from '@/lib/provider';

export const revalidate = 60;
/** Only the five configured leagues exist; anything else is a hard 404. */
export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode };

export function generateStaticParams() {
  return LEAGUES.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const league = findLeague((await params).slug);
  if (!league) return {};
  return {
    title: league.name,
    description: `${league.name} standings, fixtures, results and top scorers.`,
  };
}

export default async function LeagueLayout({ params, children }: Props) {
  const league = findLeague((await params).slug);
  if (!league) notFound();
  const season = await getProvider().getSeason(league.slug);

  return (
    <div className="space-y-6">
      <section className="relative -mx-4 overflow-hidden border-b border-line px-4 pt-10 pb-6 sm:-mx-6 sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background: `radial-gradient(700px 260px at 15% 0%, ${league.colors.primary}55, transparent 70%), radial-gradient(500px 200px at 90% 10%, ${league.colors.secondary}22, transparent 70%)`,
          }}
        />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">
              <span aria-hidden className="mr-1.5">
                {league.flag}
              </span>
              {league.country}
            </p>
            <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              {league.name}
            </h1>
          </div>
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-[11px] tracking-wider text-ink-faint uppercase">Season</dt>
              <dd className="font-display text-lg font-semibold">{season.label}</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wider text-ink-faint uppercase">Matchday</dt>
              <dd className="font-display text-lg font-semibold">
                {season.currentMatchday}
                <span className="text-ink-faint"> / {season.totalMatchdays}</span>
              </dd>
            </div>
          </dl>
        </div>
        <LeagueTabs slug={league.slug} className="mt-6" />
      </section>
      {children}
    </div>
  );
}
