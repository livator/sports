import { findLeague } from '@sports/core';
import { notFound } from 'next/navigation';
import { ScorersTable } from '@/components/scorers-table';
import { SectionHeading } from '@/components/section-heading';
import { getProvider } from '@/lib/provider';

export const revalidate = 300;

export default async function ScorersPage({ params }: { params: Promise<{ slug: string }> }) {
  const league = findLeague((await params).slug);
  if (!league) notFound();
  const scorers = await getProvider().getTopScorers(league.slug, 15);

  return (
    <section>
      <SectionHeading eyebrow="Golden boot race" title="Top scorers" />
      <ScorersTable scorers={scorers} />
    </section>
  );
}
