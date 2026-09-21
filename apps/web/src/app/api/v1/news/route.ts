import { isLeagueSlug, type LeagueSlug } from '@sports/core';
import { error, handle, intParam, json } from '@/lib/api';
import { getProvider } from '@/lib/provider';

/** `?leagues=premier-league,serie-a&limit=8`. No `leagues` means the default mix. */
export function GET(req: Request) {
  return handle(async () => {
    const provider = getProvider();
    if (!provider.getNews) return error('The configured data source has no news', 501);
    const { searchParams } = new URL(req.url);
    const leagues = (searchParams.get('leagues') ?? '')
      .split(',')
      .filter((s): s is LeagueSlug => isLeagueSlug(s));
    const limit = intParam(searchParams.get('limit'), 8, 30);
    return json(await provider.getNews(leagues, limit), {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  });
}
