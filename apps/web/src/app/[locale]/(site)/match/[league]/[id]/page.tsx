import {
  findLeague,
  formatKickoffDate,
  isLive,
  type MatchDetail,
  type MatchStat,
  type TimelineEvent,
} from '@sports/core';
import { LOCALE_TAGS, type Locale } from '@sports/i18n';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Chips } from '@/components/chips';
import { Comments } from '@/components/comments';
import { Crest } from '@/components/crest';
import { DataNotice } from '@/components/data-notice';
import { LiveRefresh } from '@/components/live-refresh';
import { LocalTime } from '@/components/local-time';
import { BackLink } from '@/components/page-header';
import { Link } from '@/i18n/navigation';
import { countComments, isValidThreadId } from '@/lib/comments';
import { competitionName } from '@/lib/competitions';
import { getProvider, safe } from '@/lib/provider';
import { scoreText, statusLabel, statusTone, teamHref, toneClass } from '@/lib/view';

type Props = {
  params: Promise<{ locale: Locale; league: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
};
type Tab = 'summary' | 'stats' | 'comments';

async function load(leagueSlug: string, id: string): Promise<MatchDetail | null | 'unsupported'> {
  const league = findLeague(leagueSlug);
  if (!league || !isValidThreadId(id)) notFound();
  const provider = getProvider();
  if (!provider.getMatch) return 'unsupported';
  return safe(provider.getMatch(league.slug, id));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { league, id } = await params;
  const detail = await load(league, id);
  if (!detail || detail === 'unsupported') return {};
  const { homeTeam, awayTeam } = detail.match;
  return { title: `${homeTeam.shortName} – ${awayTeam.shortName}` };
}

const isGoal = (e: TimelineEvent) =>
  e.kind === 'goal' || e.kind === 'penalty-goal' || e.kind === 'own-goal';

/** The design system's accent square, standing in for a goal icon. */
function GoalMark({ className, label }: { className: string; label: string }) {
  return (
    <span className={`inline-block size-2 bg-accent align-middle ${className}`}>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function StatBars({ stats, label }: { stats: MatchStat[]; label: (key: string) => string }) {
  return (
    <div className="max-w-[720px] pt-8">
      {stats.map((s) => {
        const total = s.home + s.away || 1;
        const unit = s.unit ?? '';
        return (
          <div key={s.key} className="border-b py-3.5">
            <div className="mb-2 flex justify-between tnum text-sm">
              <span className="font-extrabold">
                {s.home}
                {unit}
              </span>
              <span className="text-[13px] tracking-[0.08em] text-ink-2 uppercase">
                {label(s.key)}
              </span>
              <span className="font-extrabold">
                {s.away}
                {unit}
              </span>
            </div>
            <div className="grid h-2 grid-cols-2 gap-1">
              <div className="flex justify-end bg-neutral-200">
                <div
                  className={s.home >= s.away ? 'bg-ink' : 'bg-neutral-500'}
                  style={{ width: `${Math.round((s.home / total) * 100)}%` }}
                />
              </div>
              <div className="bg-neutral-200">
                <div
                  className={`h-full ${s.away > s.home ? 'bg-ink' : 'bg-neutral-500'}`}
                  style={{ width: `${Math.round((s.away / total) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function MatchPage({ params, searchParams }: Props) {
  const { locale, league: leagueSlug, id } = await params;
  setRequestLocale(locale);
  const league = findLeague(leagueSlug);
  if (!league) notFound();
  const t = await getTranslations('match');
  const ts = await getTranslations('status');
  const tc = await getTranslations('competitions');

  const [detail, commentCount] = await Promise.all([
    load(leagueSlug, id),
    // Comments live in our own database, so a hiccup there must not take the match page down.
    safe(countComments({ type: 'match', league: league.slug, matchId: id })),
  ]);

  if (detail === 'unsupported' || !detail) {
    return (
      <section>
        <BackLink href="/" label={t('back')} />
        <DataNotice kind={detail === 'unsupported' ? 'unsupported' : 'match'} />
      </section>
    );
  }

  const { match, stats, timeline, headToHead, attendance } = detail;
  const requestedTab = (await searchParams).tab;
  const tab: Tab =
    requestedTab === 'stats' || requestedTab === 'comments' ? requestedTab : 'summary';
  const base = `/match/${league.slug}/${match.id}`;
  const tag = LOCALE_TAGS[locale];
  const live = isLive(match.status);
  const tone = statusTone(match);
  const notStarted = match.status === 'scheduled' || match.status === 'postponed';
  const statusLong =
    match.status === 'live'
      ? ts('liveAt', { clock: statusLabel(match, ts) })
      : match.status === 'paused'
        ? ts('halfTime')
        : match.status === 'finished'
          ? ts('fullTime')
          : match.status === 'postponed'
            ? ts('postponedLong')
            : match.status === 'cancelled'
              ? ts('cancelledLong')
              : null;

  const eventText = (e: TimelineEvent): string => {
    switch (e.kind) {
      case 'goal':
        return e.player;
      case 'penalty-goal':
        return `${e.player} (${t('pen')})`;
      case 'own-goal':
        return `${e.player} (${t('og')})`;
      case 'yellow-card':
        return t('yellow', { player: e.player });
      case 'red-card':
        return t('red', { player: e.player });
      case 'substitution':
        return e.detail
          ? t('subFor', { player: e.player, other: e.detail })
          : t('sub', { player: e.player });
    }
  };

  const side = (team: typeof match.homeTeam, align: 'start' | 'end') => (
    <Link
      href={teamHref(league.slug, team.id)}
      className={`flex min-w-0 flex-col gap-3.5 hover:text-accent ${align === 'end' ? 'items-end text-right' : ''}`}
    >
      <Crest team={team} size={56} />
      <span className="text-[clamp(20px,3vw,32px)] leading-[1.05] font-extrabold tracking-[-0.02em]">
        {team.name}
      </span>
    </Link>
  );

  return (
    <section>
      {live && <LiveRefresh />}
      <BackLink href="/" label={t('back')} />
      <div className="flex flex-wrap justify-between gap-2 pt-7 pb-3 kicker">
        <Link
          href={league.hasTable ? `/tables/${league.slug}` : `/?league=${league.slug}`}
          className="text-accent-700 hover:text-accent"
        >
          {competitionName(league, tc)}
        </Link>
        <span>
          <LocalTime iso={match.kickoff} mode="date" />
          {match.venue ? ` · ${match.venue}` : ''}
          {attendance ? ` · ${attendance.toLocaleString(tag)}` : ''}
        </span>
      </div>
      <div className="rule-2" />

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 py-9">
        {side(match.homeTeam, 'start')}
        <div className="min-w-[120px] text-center">
          <div className="tnum text-[clamp(48px,8vw,88px)] leading-none font-extrabold tracking-[-0.04em] whitespace-nowrap">
            {scoreText(match)}
          </div>
          <div
            className={`mt-3 inline-flex items-center gap-2 text-sm font-bold ${toneClass[tone]}`}
          >
            {live && <span aria-hidden className="size-2 animate-pulse-live bg-accent" />}
            {statusLong ?? (
              <span>
                {ts('kickOff')} <LocalTime iso={match.kickoff} />
              </span>
            )}
          </div>
        </div>
        {side(match.awayTeam, 'end')}
      </div>

      <div className="border-t-2 border-b">
        <div className="-mb-px flex pt-1.5">
          <Chips
            label={t('sections')}
            items={[
              { href: base, label: t('summary'), active: tab === 'summary' },
              { href: `${base}?tab=stats`, label: t('stats'), active: tab === 'stats' },
              {
                href: `${base}?tab=comments`,
                label: t('comments', { count: commentCount ?? 0 }),
                active: tab === 'comments',
              },
            ]}
          />
        </div>
      </div>

      {tab === 'comments' ? (
        <div className="max-w-[720px] pt-3">
          <Comments thread={{ type: 'match', league: league.slug, matchId: match.id }} />
        </div>
      ) : tab === 'stats' ? (
        stats.length > 0 ? (
          <StatBars
            stats={stats}
            label={(key) =>
              t.has(`statLabels.${key}` as never) ? t(`statLabels.${key}` as never) : key
            }
          />
        ) : (
          <p className="pt-8 text-[17px] text-ink-2">
            {notStarted ? t('statsLater') : t('noStats')}
          </p>
        )
      ) : (
        <div className="flex flex-wrap gap-x-14 gap-y-10 pt-8">
          <div className="min-w-0 flex-[1_1_480px]">
            {notStarted ? (
              <p className="mb-6 text-[17px] text-ink-2">{t('notStarted')}</p>
            ) : timeline.length > 0 ? (
              timeline.map((e, i) => {
                const weight = isGoal(e) ? 'font-bold' : '';
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] items-center gap-3 border-b py-3 text-sm"
                  >
                    <span className={`text-right ${weight}`}>
                      {e.side === 'home' && (
                        <>
                          {eventText(e)}
                          {isGoal(e) && <GoalMark className="ml-2" label={t('goal')} />}
                        </>
                      )}
                    </span>
                    <span
                      className={`text-center tnum font-extrabold ${isGoal(e) || e.kind === 'red-card' ? 'text-accent' : 'text-ink-3'}`}
                    >
                      {e.minute}
                    </span>
                    <span className={weight}>
                      {e.side === 'away' && (
                        <>
                          {isGoal(e) && <GoalMark className="mr-2" label={t('goal')} />}
                          {eventText(e)}
                        </>
                      )}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-[17px] text-ink-2">{t('noEvents')}</p>
            )}
          </div>
          <div className="max-w-[420px] min-w-0 flex-[1_1_280px]">
            <h2 className="pb-2.5 eyebrow">{t('headToHead')}</h2>
            <div className="rule-2" />
            {headToHead.meetings.slice(0, 6).map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b py-2.5 text-sm"
              >
                <span className="truncate text-ink-2">
                  {formatKickoffDate(m.date, tag, 'UTC')} {new Date(m.date).getUTCFullYear()} ·{' '}
                  {m.homeTeam.tla} – {m.awayTeam.tla}
                </span>
                <span className="tnum font-extrabold">
                  {m.score.home ?? '–'} – {m.score.away ?? '–'}
                </span>
              </div>
            ))}
            {headToHead.meetings.length === 0 && (
              <p className="py-3 text-sm text-ink-2">{t('noMeetings')}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
