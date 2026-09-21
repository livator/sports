import { error, handle, json } from '@/lib/api';
import { getProvider } from '@/lib/provider';

type Ctx = { params: Promise<{ id: string }> };

export function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const provider = getProvider();
    if (!provider.getArticle) return error('The configured data source has no news', 501);
    return json(await provider.getArticle((await params).id), {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
    });
  });
}
