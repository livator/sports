import { isLeagueSlug, type LeagueSlug } from '@sports/core';
import { isLocale } from '@sports/i18n';
import { error, handle, intParam, json } from '@/lib/api';
import { getNewsFeed } from '@/lib/news';

/** `?leagues=premier-league,serie-a&limit=8&locale=ro`. No `leagues` means the default mix. */
export function GET(req: Request) {
  return handle(async () => {
    const { searchParams } = new URL(req.url);
    const leagues = (searchParams.get('leagues') ?? '')
      .split(',')
      .filter((s): s is LeagueSlug => isLeagueSlug(s));
    const limit = intParam(searchParams.get('limit'), 8, 30);
    const localeParam = searchParams.get('locale');
    const locale = isLocale(localeParam) ? localeParam : 'en';
    const feed = await getNewsFeed(leagues, limit, locale);
    if (!feed) return error('News is unavailable', 502);
    // Short: an article published in the console should show up within a minute.
    return json(feed, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  });
}
