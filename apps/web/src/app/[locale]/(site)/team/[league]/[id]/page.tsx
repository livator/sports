import { findLeague, signed, type Match, type TeamDetail } from '@sports/core';
import type { Locale } from '@sports/i18n';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Crest } from '@/components/crest';
import { DataNotice } from '@/components/data-notice';
import { FollowButton } from '@/components/favourites';
import { FormPips } from '@/components/form-pips';
import { LocalTime } from '@/components/local-time';
import { NewsList } from '@/components/news-list';
import { BackLink } from '@/components/page-header';
import { Link } from '@/i18n/navigation';
import { competitionName } from '@/lib/competitions';
import { getProvider, safe, safeOrNotFound } from '@/lib/provider';
import { matchHref, playerHref, scoreText, sideWeight } from '@/lib/view';

type Props = { params: Promise<{ locale: Locale; league: string; id: string }> };

async function load(leagueSlug: string, id: string): Promise<TeamDetail | null | 'unsupported'> {
  const league = findLeague(leagueSlug);
  if (!league) notFound();
  const provider = getProvider();
  if (!provider.getTeam) return 'unsupported';
  return safeOrNotFound(provider.getTeam(league.slug, id));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, league, id } = await params;
  const detail = await load(league, id);
  if (detail && detail !== 'unsupported') return { title: detail.team.name };
  const t = await getTranslations({ locale, namespace: 'team' });
  return { title: t('fallbackTitle') };
}

function FixtureRow({ match }: { match: Match }) {
  const played = match.status !== 'scheduled' && match.status !== 'postponed';
  return (
    <Link
      href={matchHref(match)}
      className="grid grid-cols-[96px_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b px-1 py-3.5 text-sm hover:bg-hover"
    >
      <span className={`text-[13px] font-bold ${played ? 'text-ink-3' : 'text-ink'}`}>
        <LocalTime iso={match.kickoff} mode="date" />
      </span>
      <span className={`truncate ${sideWeight(match, 'home')}`}>{match.homeTeam.shortName}</span>
      <span className="min-w-14 text-center tnum text-lg font-extrabold">
        {played ? scoreText(match) : <LocalTime iso={match.kickoff} />}
      </span>
      <span className={`truncate ${sideWeight(match, 'away')}`}>{match.awayTeam.shortName}</span>
    </Link>
  );
}

export default async function TeamPage({ params }: Props) {
  const { locale, league: leagueSlug, id } = await params;
  setRequestLocale(locale);
  const league = findLeague(leagueSlug);
  if (!league) notFound();
  const t = await getTranslations('team');
  const tf = await getTranslations('fixtures');
  const name = competitionName(league, await getTranslations('competitions'));

  const [detail, standings] = await Promise.all([
    load(leagueSlug, id),
    safe(getProvider().getStandings(league.slug)),
  ]);
  const back = <BackLink href={`/tables/${league.slug}`} label={tf('back', { league: name })} />;

  if (detail === 'unsupported' || !detail) {
    return (
      <section>
        {back}
        <DataNotice kind={detail === 'unsupported' ? 'unsupported' : 'team'} />
      </section>
    );
  }

  const { team, results, fixtures, squad, news } = detail;
  const next = fixtures[0];
  const nextVenue = next?.venue ?? (next?.homeTeam.id === team.id ? detail.venue : undefined);
  const row = standings?.rows.find((r) => r.team.id === team.id);
  const kpis = row
    ? [
        { label: t('points'), value: String(row.points), accent: true },
        { label: t('played'), value: String(row.played) },
        { label: t('won'), value: String(row.won) },
        { label: t('goalDiff'), value: signed(row.goalDifference) },
      ]
    : [];
  // Next fixtures first (soonest on top), then results (most recent on top).
  const matches = [...fixtures.slice(0, 5), ...results.slice(0, 6)];

  return (
    <section>
      {back}
      <div className="flex flex-wrap items-end justify-between gap-5 pt-8 pb-5">
        <div className="flex min-w-0 items-end gap-5">
          <Crest team={team} size={72} />
          <div className="min-w-0">
            <span className="mb-2 block kicker">
              {row ? t('kicker', { league: name, pos: row.position }) : name}
            </span>
            <h1 className="text-[clamp(32px,4.5vw,56px)] leading-[1.02] font-extrabold tracking-[-0.02em]">
              {team.name}
            </h1>
          </div>
        </div>
        <FollowButton
          club={{
            id: team.id,
            name: team.shortName,
            league: league.slug,
            ...(team.crestUrl ? { crestUrl: team.crestUrl } : {}),
          }}
        />
      </div>
      <div className="rule-2" />

      {row && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] border-b-2">
          {kpis.map((k) => (
            <div key={k.label} className="border-r py-5 pr-4 pl-4 first:pl-0">
              <div
                className={`tnum text-4xl leading-none font-extrabold tracking-[-0.02em] ${k.accent ? 'text-accent' : ''}`}
              >
                {k.value}
              </div>
              <div className="mt-2.5 text-xs tracking-[0.08em] text-ink-2 uppercase">{k.label}</div>
            </div>
          ))}
          <div className="py-5 pl-4">
            <FormPips form={row.form} size="lg" />
            <div className="mt-2.5 text-xs tracking-[0.08em] text-ink-2 uppercase">{t('form')}</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-14 gap-y-10 pt-8">
        <div className="min-w-0 flex-[1_1_480px]">
          {next && (
            <Link
              href={matchHref(next)}
              className="mb-9 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-ink px-6 py-5 text-ground hover:text-ground"
            >
              <span className="min-w-0">
                <span className="mb-2 block text-xs tracking-[0.08em] text-accent uppercase">
                  {t('nextMatch')} · <LocalTime iso={next.kickoff} mode="date" />,{' '}
                  <LocalTime iso={next.kickoff} />
                </span>
                <span className="block text-[clamp(18px,2.4vw,26px)] leading-[1.1] font-extrabold tracking-[-0.02em]">
                  {next.homeTeam.shortName} v {next.awayTeam.shortName}
                </span>
                <span className="mt-2 block text-[13px] opacity-75">
                  {name}
                  {nextVenue ? ` · ${nextVenue}` : ''}
                </span>
              </span>
              <span aria-hidden className="text-2xl">
                ›
              </span>
            </Link>
          )}
          <h2 className="pb-2.5 eyebrow">{t('fixturesResults')}</h2>
          <div className="rule-2" />
          {matches.length > 0 ? (
            matches.map((m) => <FixtureRow key={m.id} match={m} />)
          ) : (
            <p className="py-4 text-sm text-ink-2">{t('noMatches')}</p>
          )}
        </div>

        <div className="max-w-[460px] min-w-0 flex-[1_1_300px]">
          <h2 className="pb-2.5 eyebrow">{t('squad')}</h2>
          {squad.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th scope="col" className="w-9">
                    {t('number')}
                  </th>
                  <th scope="col">{t('player')}</th>
                  <th scope="col">{t('position')}</th>
                  <th scope="col" className="num">
                    {t('goalsShort')}
                  </th>
                  <th scope="col" className="num">
                    {t('assistsShort')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {squad.map((p) => (
                  <tr key={p.id}>
                    <td className="text-ink-3">{p.number ?? ''}</td>
                    <td className="font-semibold">
                      <Link href={playerHref(league.slug, p.id)} className="hover:text-accent">
                        {p.name}
                      </Link>
                    </td>
                    <td className="text-ink-3">
                      {p.position && t.has(`positionsShort.${p.position}` as never)
                        ? t(`positionsShort.${p.position}` as never)
                        : (p.position ?? '')}
                    </td>
                    <td className="num">{p.goals}</td>
                    <td className="num">{p.assists}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <>
              <div className="rule-2" />
              <p className="py-4 text-sm text-ink-2">{t('squadUnavailable')}</p>
            </>
          )}
          {news && news.length > 0 && (
            <div className="pt-9">
              <NewsList articles={news} heading={t('relatedNews')} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
