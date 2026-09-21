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
  /** Full text as HTML. Only on the single-article endpoint. Never passed on whole. */
  story?: string;
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
/**
 * How much of a publisher's story may be quoted. The text is theirs (often a wire agency's,
 * licensed to them), so this stays a teaser: a few sentences, credited, with a link to the
 * rest. Raising it turns quoting into republishing. Do not.
 */
export const EXCERPT_MAX_CHARS = 480;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

function toText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The opening of a story as plain paragraphs, at most `max` characters in all. Whole
 * paragraphs while they fit; then whole sentences of the next one. Embedded media, captions
 * and scripts are dropped before anything is read, and the result is text, never HTML.
 */
export function excerptOf(storyHtml: string | undefined, max = EXCERPT_MAX_CHARS): string[] {
  if (!storyHtml) return [];
  const cleaned = storyHtml.replace(
    /<(script|style|figure|aside|iframe|photo\d*|video\d*|inline\d*|alsosee)[^>]*>[\s\S]*?<\/\1>/gi,
    ' ',
  );
  const paragraphs = [...cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => toText(m[1] ?? ''))
    .filter((p) => p.length > 0);

  const out: string[] = [];
  let used = 0;
  for (const paragraph of paragraphs) {
    if (used + paragraph.length <= max) {
      out.push(paragraph);
      used += paragraph.length;
      continue;
    }
    // Whole sentences of the paragraph that does not fit, so it never stops mid-thought.
    const sentences = paragraph.match(/[^.!?]+[.!?]+["”’)]*\s*/g) ?? [];
    let partial = '';
    for (const sentence of sentences) {
      if (used + partial.length + sentence.length > max) break;
      partial += sentence;
    }
    if (partial.trim()) out.push(partial.trim());
    break;
  }
  return out;
}

/**
 * An address from the feed, only if it is a plain web address. These end up in `href` and
 * `src`, and the feed is somebody else's data: a "javascript:" link must never get that far.
 */
function webUrl(value: string | undefined, protocols: readonly string[]): string | undefined {
  if (!value) return undefined;
  try {
    return protocols.includes(new URL(value).protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function mapNewsItem(item: EspnNewsItem, knownLeague?: LeagueSlug): NewsArticle | null {
  const sourceUrl = webUrl(item.links?.web?.href, ['https:', 'http:']);
  if (item.type === 'Media' || !item.headline || !item.published || !sourceUrl) return null;
  const league = knownLeague ? { slug: knownLeague } : leagueOf(item);
  // Prefer a wide image; ESPN lists several crops.
  const image = [...(item.images ?? [])]
    .filter((i) => webUrl(i.url, ['https:']))
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  const author = item.byline?.trim();
  // The summary usually repeats the first sentence; an excerpt that only says it again adds nothing.
  const summary = (item.description ?? '').trim();
  const excerpt = excerptOf(item.story).filter((p) => p !== summary);

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
    ...(excerpt.length > 0 ? { excerpt } : {}),
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
