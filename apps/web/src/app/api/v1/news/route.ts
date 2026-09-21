import { isLeagueSlug, type LeagueSlug } from '@sports/core';
import { error, handle, intParam, json } from '@/lib/api';
import { getNewsFeed } from '@/lib/news';

/** `?leagues=premier-league,serie-a&limit=8`. No `leagues` means the default mix. */
export function GET(req: Request) {
  return handle(async () => {
    const { searchParams } = new URL(req.url);
    const leagues = (searchParams.get('leagues') ?? '')
      .split(',')
      .filter((s): s is LeagueSlug => isLeagueSlug(s));
    const limit = intParam(searchParams.get('limit'), 8, 30);
    const feed = await getNewsFeed(leagues, limit);
    if (!feed) return error('News is unavailable', 502);
    // Short: an article published in the console should show up within a minute.
    return json(feed, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  });
}
