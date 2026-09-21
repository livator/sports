import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminTime } from '@/components/admin/admin-time';
import { sectionLabel, STATE_LABEL, STATE_TAG } from '@/components/admin/shared';
import { requireAdmin } from '@/lib/admin';
import { getOverview, listUsersForAdmin } from '@/lib/admin-data';
import { initialsOf } from '@/lib/admin-format';
import { listArticlesForAdmin } from '@/lib/articles';

export const metadata: Metadata = { title: 'Overview' };

export default async function OverviewPage() {
  await requireAdmin();
  const [overview, articles, users] = await Promise.all([
    getOverview(),
    listArticlesForAdmin(),
    listUsersForAdmin(),
  ]);
  const number = (n: number) => n.toLocaleString('en-GB');
  const kpis = [
    { label: 'Registered users', value: number(overview.users) },
    { label: 'Active today', value: number(overview.activeToday), accent: true },
    { label: 'Published articles', value: number(overview.publishedArticles) },
    { label: 'Article views', value: number(overview.articleViews) },
    { label: 'Comments', value: number(overview.comments) },
  ];

  return (
    <section>
      <div className="pt-10 pb-5">
        <span className="mb-2.5 block kicker">
          <AdminTime iso={new Date().toISOString()} />
        </span>
        <h1 className="-ml-[0.04em] text-[clamp(36px,5vw,64px)] leading-[1.02] font-extrabold tracking-[-0.02em]">
          Overview
        </h1>
      </div>
      <div className="rule-2" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] border-b-2">
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
      </div>

      <div className="flex flex-wrap gap-x-14 gap-y-10 pt-8">
        <div className="min-w-0 flex-[1_1_480px]">
          <div className="flex items-baseline justify-between pb-2.5">
            <h2 className="eyebrow">Recent articles</h2>
            <Link href="/admin/news" className="text-xs text-accent-700 hover:text-accent">
              All news
            </Link>
          </div>
          <div className="rule-2" />
          {articles.length === 0 && (
            <p className="py-4 text-sm text-ink-2">
              Nothing written yet.{' '}
              <Link href="/admin/news/new" className="text-accent-700 hover:text-accent">
                Write the first article
              </Link>
              .
            </p>
          )}
          {articles.slice(0, 5).map((a) => (
            <Link
              key={a.id}
              href={`/admin/news/${a.id}`}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-b px-1 py-3.5 hover:bg-hover"
            >
              <span className="min-w-0">
                <span className="mb-1 block text-[11px] font-semibold tracking-[0.08em] text-accent-700 uppercase">
                  {sectionLabel(a.leagueSlug, a.tag)}
                </span>
                <span className="block truncate text-[15px] font-semibold">{a.title}</span>
              </span>
              <span className="tnum text-[13px] text-ink-3">{number(a.views)} views</span>
              <span className={`tag ${STATE_TAG[a.state]}`}>{STATE_LABEL[a.state]}</span>
            </Link>
          ))}
        </div>

        <div className="max-w-[420px] min-w-0 flex-[1_1_300px]">
          <div className="flex items-baseline justify-between pb-2.5">
            <h2 className="eyebrow">New sign-ups</h2>
            <Link href="/admin/users" className="text-xs text-accent-700 hover:text-accent">
              All users
            </Link>
          </div>
          <div className="rule-2" />
          {users.slice(0, 6).map((u) => (
            <Link
              key={u.id}
              href={`/admin/users?user=${encodeURIComponent(u.id)}`}
              className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-b px-1 py-2.5 text-sm hover:bg-hover"
            >
              <span className="grid size-8 place-items-center bg-ink text-[11px] font-extrabold text-ground">
                {initialsOf(u.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{u.name}</span>
                <span className="block truncate text-xs text-ink-3">{u.email}</span>
              </span>
              <span className="text-xs text-ink-3">
                <AdminTime iso={u.joinedAt} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
