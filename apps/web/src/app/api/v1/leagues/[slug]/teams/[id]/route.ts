import { getProvider } from '@/lib/provider';
import { error, handle, isResponse, json, resolveLeague } from '@/lib/api';

type Ctx = { params: Promise<{ slug: string; id: string }> };

export function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { slug, id } = await params;
    const league = resolveLeague(slug);
    if (isResponse(league)) return league;
    const provider = getProvider();
    if (!provider.getTeam)
      return error('The configured data source cannot provide team pages', 501);
    return json(await provider.getTeam(league.slug, id));
  });
}
