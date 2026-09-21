import type { Metadata } from 'next';
import { ArticleEditor } from '@/components/admin/article-editor';
import { requireAdmin } from '@/lib/admin';

export const metadata: Metadata = { title: 'New article' };

export default async function NewArticlePage() {
  const session = await requireAdmin();
  return <ArticleEditor article={null} defaultAuthor={session.user.name} />;
}
