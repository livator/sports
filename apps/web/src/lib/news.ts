import 'server-only';

import { isOwnArticleId, type LeagueSlug, type NewsArticle } from '@sports/core';
import type { Locale } from '@sports/i18n';
import { getLiveArticle, listLiveArticles } from './articles';
import { safe } from './provider';

/**
 * The site's news list: our own staff-written articles, newest first with featured ones
 * leading. There is no outside source any more; every story is written in-house, in all three
 * site languages, so there is nothing to merge or attribute.
 */
export async function getNewsFeed(
  leagues: readonly LeagueSlug[],
  limit: number,
  locale: Locale = 'en',
): Promise<NewsArticle[] | null> {
  const articles = await safe(listLiveArticles(leagues, limit, locale));
  if (!articles) return null;
  const byTime = (a: NewsArticle, b: NewsArticle) => b.publishedAt.localeCompare(a.publishedAt);
  const featured = articles.filter((a) => a.featured).sort(byTime);
  const rest = articles.filter((a) => !a.featured).sort(byTime);
  return [...featured, ...rest].slice(0, limit);
}

/** One of our own articles by id. Null when not found or not live. */
export async function getAnyArticle(
  id: string,
  locale: Locale = 'en',
): Promise<NewsArticle | null | 'unsupported'> {
  if (!isOwnArticleId(id)) return 'unsupported';
  return getLiveArticle(id, locale);
}

export const isArticleId = isOwnArticleId;
