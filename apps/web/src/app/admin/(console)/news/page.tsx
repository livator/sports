import type { Metadata } from 'next';
import Link from 'next/link';
import { NewsTable } from '@/components/admin/news-table';
import { sectionLabel, type ArticleListItem } from '@/components/admin/shared';
import { requireAdmin } from '@/lib/admin';
import { adminTitle, listArticlesForAdmin } from '@/lib/articles';

export const metadata: Metadata = { title: 'News' };

export default async function AdminNewsPage() {
  await requireAdmin();
  const articles = await listArticlesForAdmin();
  const items = articles.map((a): ArticleListItem => ({
    id: a.id,
    title: adminTitle(a),
    section: sectionLabel(a.leagueSlug, a.tag),
    author: a.author,
    updatedAt: a.updatedAt.toISOString(),
    views: a.views,
    comments: a.comments,
    state: a.state,
  }));

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-10 pb-5">
        <div>
          <span className="mb-2.5 block kicker">
            {items.length} {items.length === 1 ? 'article' : 'articles'}
          </span>
          <h1 className="-ml-[0.04em] text-[clamp(36px,5vw,64px)] leading-[1.02] font-extrabold tracking-[-0.02em]">
            News
          </h1>
        </div>
        <Link href="/admin/news/new" className="btn btn-primary">
          + New article
        </Link>
      </div>
      <div className="rule-2" />
      <NewsTable articles={items} />
    </section>
  );
}
