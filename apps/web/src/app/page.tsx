import { LEAGUES, SEED_TEAMS, toIsoDate } from '@sports/core';
import { LeagueCard } from '@/components/league-card';
import { LiveMatches } from '@/components/live-matches';
import { SectionHeading } from '@/components/section-heading';
import { getProvider } from '@/lib/provider';

export const revalidate = 60;

export default async function HomePage() {
  const provider = getProvider();
  const today = toIsoDate(new Date());
  const [todayMatches, standings] = await Promise.all([
    provider.getMatchesByDate(today),
    Promise.all(LEAGUES.map((l) => provider.getStandings(l.slug))),
  ]);
  const clubCount = Object.values(SEED_TEAMS).reduce((n, t) => n + t.length, 0);

  return (
    <div className="space-y-14">
      <section className="relative -mx-4 overflow-hidden px-4 pt-14 pb-10 sm:-mx-6 sm:px-6 sm:pt-20">
        <div aria-hidden className="absolute inset-0 -z-10 grid-fade" />
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex animate-fade-up items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs font-medium text-ink-muted">
            <span className="inline-block size-1.5 rounded-full bg-pitch-400" />
            Europe’s top 5 leagues, one place
          </p>
          <h1 className="animate-fade-up font-display text-4xl font-bold tracking-tight [animation-delay:60ms] sm:text-6xl">
            Every table. Every fixture.
            <br />
            <span className="text-gradient">Pitchside.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl animate-fade-up text-base text-ink-muted [animation-delay:120ms] sm:text-lg">
            Live scores, standings and top scorers for the Premier League, LaLiga, Serie A,
            Bundesliga and Ligue 1.
          </p>
          <dl className="mx-auto mt-8 grid max-w-md animate-fade-up grid-cols-3 gap-3 [animation-delay:180ms]">
            <Stat label="Leagues" value={LEAGUES.length} />
            <Stat label="Clubs" value={clubCount} />
            <Stat label="Matches today" value={todayMatches.length} />
          </dl>
        </div>
      </section>

      <section>
        <SectionHeading eyebrow="Matchday" title="Today" />
        <LiveMatches date={today} initialMatches={todayMatches} />
      </section>

      <section>
        <SectionHeading eyebrow="Competitions" title="Leagues" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LEAGUES.map((league, i) => (
            <LeagueCard key={league.slug} league={league} standings={standings[i]!} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl px-3 py-3 glass">
      <dd className="font-display text-2xl font-bold tabular">{value}</dd>
      <dt className="text-[11px] font-medium tracking-wider text-ink-muted uppercase">{label}</dt>
    </div>
  );
}
