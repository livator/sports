import { getProvider } from '@/lib/provider';
import { handle, isResponse, json, resolveLeague } from '@/lib/api';

type Ctx = { params: Promise<{ slug: string }> };

export function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const league = resolveLeague((await params).slug);
    if (isResponse(league)) return league;
    const includeForm = new URL(req.url).searchParams.get('form') !== '0';
    return json(await getProvider().getStandings(league.slug, { includeForm }));
  });
}
