import { findLeague, type PlayerDetail } from '@sports/core';
import { LOCALE_TAGS, type Locale } from '@sports/i18n';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Crest } from '@/components/crest';
import { DataNotice } from '@/components/data-notice';
import { BackLink } from '@/components/page-header';
import { Link } from '@/i18n/navigation';
import { competitionName } from '@/lib/competitions';
import { getProvider, safe } from '@/lib/provider';
import { seasonLabelFor, teamHref } from '@/lib/view';

type Props = { params: Promise<{ locale: Locale; league: string; id: string }> };

async function load(leagueSlug: string, id: string): Promise<PlayerDetail | null | 'unsupported'> {
  const league = findLeague(leagueSlug);
  if (!league) notFound();
  const provider = getProvider();
  if (!provider.getPlayer) return 'unsupported';
  return safe(provider.getPlayer(league.slug, id));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, league, id } = await params;
  const detail = await load(league, id);
  if (detail && detail !== 'unsupported') return { title: detail.player.name };
  const t = await getTranslations({ locale, namespace: 'player' });
  return { title: t('fallbackTitle') };
}

export default async function PlayerPage({ params }: Props) {
  const { locale, league: leagueSlug, id } = await params;
  setRequestLocale(locale);
  const league = findLeague(leagueSlug);
  if (!league) notFound();
  const t = await getTranslations('player');
  const tp = await getTranslations('players');
  const detail = await load(leagueSlug, id);

  if (detail === 'unsupported' || !detail) {
    return (
      <section>
        <BackLink href="/players" label={tp('back')} />
        <DataNotice kind={detail === 'unsupported' ? 'unsupported' : 'player'} />
      </section>
    );
  }

  const { player, team, log } = detail;
  const shortDate = new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const position =
    player.position && t.has(`positions.${player.position}` as never)
      ? t(`positions.${player.position}` as never)
      : player.position;
  const kicker = [position, player.nationality, player.age ? t('age', { age: player.age }) : null]
    .filter(Boolean)
    .join(' · ');
  const kpis = [
    { label: t('goals'), value: player.goals, accent: true },
    { label: t('assists'), value: player.assists },
    { label: t('apps'), value: player.appearances },
    ...(player.shots !== undefined ? [{ label: t('shots'), value: player.shots }] : []),
  ];
  const facts = (
    [
      team ? [t('club'), team.shortName] : null,
      [t('league'), competitionName(league, await getTranslations('competitions'))],
      position ? [t('position'), position] : null,
      player.nationality ? [t('nationality'), player.nationality] : null,
      player.dateOfBirth ? [t('born'), player.dateOfBirth] : null,
      player.height ? [t('height'), player.height] : null,
      player.shots
        ? [t('shotsPerGoal'), player.goals ? (player.shots / player.goals).toFixed(1) : '–']
        : null,
    ] as Array<[string, string] | null>
  ).filter((f): f is [string, string] => f !== null);
  const maxGoals = Math.max(1, ...log.map((m) => m.goals));
  const day = (iso: string | undefined) => (iso ? shortDate.format(new Date(iso)) : '');

  return (
    <section>
      <BackLink
        href={team ? teamHref(league.slug, team.id) : '/players'}
        label={team ? team.name : tp('back')}
      />
      <div className="flex flex-wrap items-end gap-8 pt-8 pb-6">
        {player.headshotUrl ? (
          <Image
            src={player.headshotUrl}
            alt=""
            width={120}
            height={150}
            className="h-[150px] w-[120px] flex-none bg-neutral-300 object-cover object-top contrast-[1.08] grayscale"
          />
        ) : (
          <div
            aria-hidden
            className="grid h-[150px] w-[120px] flex-none place-items-center bg-neutral-300 text-4xl font-extrabold text-neutral-700"
          >
            {player.number ?? ''}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {kicker && <span className="mb-2 block kicker">{kicker}</span>}
          <h1 className="mb-3.5 text-[clamp(32px,4.5vw,56px)] leading-[1.02] font-extrabold tracking-[-0.02em]">
            {player.number && <span className="text-accent">{player.number} </span>}
            {player.name}
          </h1>
          {team && (
            <Link
              href={teamHref(league.slug, team.id)}
              className="inline-flex items-center gap-2.5 font-semibold hover:text-accent"
            >
              <Crest team={team} size={24} />
              {team.name}
            </Link>
          )}
        </div>
      </div>
      <div className="rule-2" />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] border-b-2">
        {kpis.map((k) => (
          <div key={k.label} className="border-r py-5 pr-4 pl-4 first:pl-0 last:border-r-0">
            <div
              className={`tnum text-4xl leading-none font-extrabold tracking-[-0.02em] ${k.accent ? 'text-accent' : ''}`}
            >
              {k.value}
            </div>
            <div className="mt-2.5 text-xs tracking-[0.08em] text-ink-2 uppercase">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-14 gap-y-10 pt-8">
        <div className="min-w-0 flex-[1_1_480px]">
          <div className="flex justify-between gap-3 pb-2.5 eyebrow">
            <h2>{t('goalsByMatch')}</h2>
            <span className="font-normal text-ink-3">
              {t('season', { season: seasonLabelFor(new Date()) })}
            </span>
          </div>
          <div className="rule-2" />
          {log.length > 0 ? (
            <>
              <div
                className="flex h-[120px] items-end gap-1 pt-4"
                role="img"
                aria-label={t('chartLabel')}
              >
                {log.map((m) => (
                  <div
                    key={m.matchId}
                    title={`${day(m.date)} ${m.opponent ? t('versus', { opponent: m.opponent }) : ''}: ${m.goals}`.trim()}
                    className={`min-h-[3px] max-w-10 flex-1 ${m.goals ? 'bg-ink' : 'bg-neutral-300'}`}
                    style={{ height: `${Math.round((m.goals / maxGoals) * 100)}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between pt-2 tnum text-xs text-ink-3">
                <span>{day(log[0]?.date)}</span>
                <span>{day(log.at(-1)?.date)}</span>
              </div>
              <div className="pt-6">
                {log
                  .filter((m) => m.goals > 0 || m.assists > 0)
                  .reverse()
                  .map((m) => (
                    <Link
                      key={m.matchId}
                      href={`/match/${league.slug}/${m.matchId}`}
                      className="grid grid-cols-[72px_minmax(0,1fr)_auto] gap-3 border-b px-1 py-2.5 text-sm hover:bg-hover"
                    >
                      <span className="tnum text-ink-3">{day(m.date)}</span>
                      <span className="truncate">
                        {m.opponent ? t('versus', { opponent: m.opponent }) : ''}
                      </span>
                      <span className="tnum font-extrabold">
                        {[
                          m.goals ? t('goalsTally', { count: m.goals }) : null,
                          m.assists ? t('assistsTally', { count: m.assists }) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </Link>
                  ))}
              </div>
            </>
          ) : (
            <p className="py-4 text-sm text-ink-2">{t('noLog')}</p>
          )}
        </div>

        <div className="max-w-[420px] min-w-0 flex-[1_1_280px]">
          <h2 className="pb-2.5 eyebrow">{t('profile')}</h2>
          <div className="rule-2" />
          {facts.map(([k, v]) => (
            <div
              key={k}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b py-2.5 text-sm"
            >
              <span className="text-ink-2">{k}</span>
              <span className="font-semibold">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
