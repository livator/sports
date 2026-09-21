import 'server-only';

import { isOwnArticleId, type LeagueSlug, type NewsArticle } from '@sports/core';
import { getLiveArticle, listLiveArticles } from './articles';
import { getProvider, safe } from './provider';

/**
 * The site's news list: our own articles together with the data source's headlines.
 * Featured articles lead; everything else is newest first. Returns null only when neither
 * side could be read, so one failing source never blanks the list.
 */
export async function getNewsFeed(
  leagues: readonly LeagueSlug[],
  limit: number,
): Promise<NewsArticle[] | null> {
  const provider = getProvider();
  const [own, external] = await Promise.all([
    safe(listLiveArticles(leagues, limit)),
    provider.getNews ? safe(provider.getNews(leagues, limit)) : Promise.resolve([]),
  ]);
  if (!own && !external) return null;

  const byTime = (a: NewsArticle, b: NewsArticle) => b.publishedAt.localeCompare(a.publishedAt);
  const featured = (own ?? []).filter((a) => a.featured).sort(byTime);
  const rest = [...(own ?? []).filter((a) => !a.featured), ...(external ?? [])].sort(byTime);
  return [...featured, ...rest].slice(0, limit);
}

/** One article by id, from our own database or from the data source. Null when not found. */
export async function getAnyArticle(id: string): Promise<NewsArticle | null | 'unsupported'> {
  if (isOwnArticleId(id)) return getLiveArticle(id);
  const provider = getProvider();
  if (!provider.getArticle) return 'unsupported';
  return provider.getArticle(id);
}

export const isArticleId = (id: string): boolean => /^\d{1,12}$/.test(id) || isOwnArticleId(id);
