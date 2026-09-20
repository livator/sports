import { findLeague } from '@sports/core';
import { notFound } from 'next/navigation';
import { SectionHeading } from '@/components/section-heading';
import { StandingsTable } from '@/components/standings-table';
import { getProvider } from '@/lib/provider';

export const revalidate = 60;

export default async function StandingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const league = findLeague((await params).slug);
  if (!league) notFound();
  const standings = await getProvider().getStandings(league.slug);

  return (
    <section>
      <SectionHeading eyebrow="Table" title={`${league.name} standings`} />
      <StandingsTable league={league} standings={standings} />
    </section>
  );
}
