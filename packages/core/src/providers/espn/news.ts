import type { LeagueSlug, NewsArticle } from '../../types';

/* ---------- Wire types ---------- */

export interface EspnNewsItem {
  id: number | string;
  /** "Story", "HeadlineNews" or "Media" (a video clip, which is not an article). */
  type?: string;
  headline?: string;
  description?: string;
  published?: string;
  byline?: string;
  images?: Array<{ url?: string; credit?: string; width?: number }>;
  links?: { web?: { href?: string } };
  categories?: Array<{
    type?: string;
    description?: string;
    /** ESPN's short league number, the one that appears in logo URLs. */
    leagueId?: number;
    league?: { id?: number | string };
  }>;
}

export interface EspnNewsFeed {
  articles?: EspnNewsItem[];
}

export interface EspnNewsHeadlines {
  headlines?: EspnNewsItem[];
}

/* ---------- League lookup ---------- */

/** ESPN's long league ids, as they appear on scoreboards and in `category.league.id`. */
const BY_LEAGUE_ID: Record<string, LeagueSlug> = {
  '775': 'champions-league',
  '776': 'europa-league',
  '20296': 'conference-league',
  '2395': 'nations-league',
  '3947': 'euro-qualifying',
  '3922': 'friendlies',
  '700': 'premier-league',
  '740': 'la-liga',
  '730': 'serie-a',
  '720': 'bundesliga',
  '710': 'ligue-1',
  '725': 'eredivisie',
  '715': 'primeira-liga',
  '3901': 'belgian-pro-league',
  '3946': 'super-lig',
  '735': 'scottish-premiership',
  '3955': 'super-league-greece',
  '3907': 'austrian-bundesliga',
  '3913': 'danish-superliga',
  '3945': 'allsvenskan',
  '3960': 'eliteserien',
  '3939': 'russian-premier-league',
};

/** The short numbers some payloads use instead (`category.leagueId`). */
const BY_SHORT_ID: Record<string, LeagueSlug> = {
  '2': 'champions-league',
  '2310': 'europa-league',
  '20296': 'conference-league',
  '2395': 'nations-league',
  '56': 'euro-qualifying',
  '53': 'friendlies',
  '23': 'premier-league',
  '15': 'la-liga',
  '12': 'serie-a',
  '10': 'bundesliga',
  '9': 'ligue-1',
  '11': 'eredivisie',
  '14': 'primeira-liga',
  '6': 'belgian-pro-league',
  '18': 'super-lig',
  '45': 'scottish-premiership',
  '98': 'super-league-greece',
  '5': 'austrian-bundesliga',
  '16': 'allsvenskan',
  '106': 'russian-premier-league',
};

/** First league category that maps onto a competition we know. "Soccer" (600) never does. */
function leagueOf(item: EspnNewsItem): { slug?: LeagueSlug; label?: string } {
  const leagues = (item.categories ?? []).filter((c) => c.type === 'league');
  for (const c of leagues) {
    const slug = BY_LEAGUE_ID[String(c.league?.id ?? '')] ?? BY_SHORT_ID[String(c.leagueId ?? '')];
    if (slug) return { slug };
  }
  const label = leagues.find((c) => c.description && c.description !== 'Soccer')?.description;
  return label ? { label } : {};
}

/* ---------- Mapper ---------- */

/**
 * Maps one ESPN item. Returns null for video clips and for anything without a headline or a
 * link back to the publisher, since an item we cannot attribute is not shown.
 * `knownLeague` is the feed the item came from, which beats guessing from its categories.
 */
export function mapNewsItem(item: EspnNewsItem, knownLeague?: LeagueSlug): NewsArticle | null {
  const sourceUrl = item.links?.web?.href;
  if (item.type === 'Media' || !item.headline || !item.published || !sourceUrl) return null;
  const league = knownLeague ? { slug: knownLeague } : leagueOf(item);
  // Prefer a wide image; ESPN lists several crops.
  const image = [...(item.images ?? [])]
    .filter((i) => i.url)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  const author = item.byline?.trim();

  return {
    id: String(item.id),
    title: item.headline.trim(),
    summary: (item.description ?? '').trim(),
    publishedAt: new Date(item.published).toISOString(),
    ...(league.slug ? { leagueSlug: league.slug } : {}),
    ...(!league.slug && league.label ? { tag: league.label } : {}),
    ...(author ? { author } : {}),
    ...(image?.url ? { imageUrl: image.url } : {}),
    ...(image?.credit ? { imageCredit: image.credit } : {}),
    sourceName: 'ESPN',
    sourceUrl,
  };
}

/** Newest first, one entry per story even when several feeds carry it. */
export function mergeNews(lists: NewsArticle[][], limit: number): NewsArticle[] {
  const seen = new Map<string, NewsArticle>();
  for (const article of lists.flat()) if (!seen.has(article.id)) seen.set(article.id, article);
  return [...seen.values()]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}
