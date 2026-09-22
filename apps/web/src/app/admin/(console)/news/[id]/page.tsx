import { isOwnArticleId } from '@sports/core';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleEditor } from '@/components/admin/article-editor';
import { requireAdmin } from '@/lib/admin';
import { articleState, getArticleForAdmin } from '@/lib/articles';

export const metadata: Metadata = { title: 'Edit article' };

type Props = { params: Promise<{ id: string }> };

export default async function EditArticlePage({ params }: Props) {
  const session = await requireAdmin();
  const { id } = await params;
  const row = isOwnArticleId(id) ? await getArticleForAdmin(id) : null;
  if (!row) notFound();

  return (
    <ArticleEditor
      // A different article is a different editor: never carry typed text across.
      key={row.id}
      defaultAuthor={session.user.name}
      article={{
        id: row.id,
        state: articleState(row),
        updatedAt: row.updatedAt.toISOString(),
        publishedAt: row.publishedAt?.toISOString() ?? null,
        leagueSlug: row.leagueSlug,
        tag: row.tag,
        title: { en: row.titleEn, ru: row.titleRu, ro: row.titleRo },
        summary: { en: row.summaryEn, ru: row.summaryRu, ro: row.summaryRo },
        body: { en: row.bodyEn, ru: row.bodyRu, ro: row.bodyRo },
        author: row.author,
        imageUrl: row.imageUrl ?? '',
        caption: row.caption,
        featured: row.featured,
        commentsOn: row.commentsOn,
      }}
    />
  );
}
