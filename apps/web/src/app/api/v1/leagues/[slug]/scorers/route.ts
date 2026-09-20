import { getProvider } from '@/lib/provider';
import { handle, intParam, isResponse, json, resolveLeague } from '@/lib/api';

type Ctx = { params: Promise<{ slug: string }> };

export function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const league = resolveLeague((await params).slug);
    if (isResponse(league)) return league;
    const limit = intParam(new URL(req.url).searchParams.get('limit'), 10, 50);
    return json(await getProvider().getTopScorers(league.slug, limit));
  });
}
