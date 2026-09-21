import { error, handle, json } from '@/lib/api';
import { getAnyArticle, isArticleId } from '@/lib/news';

type Ctx = { params: Promise<{ id: string }> };

export function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    if (!isArticleId(id)) return error('Invalid article id', 400);
    const article = await getAnyArticle(id);
    if (article === 'unsupported') return error('The configured data source has no news', 501);
    if (!article) return error('No such article', 404);
    return json(article, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' },
    });
  });
}
