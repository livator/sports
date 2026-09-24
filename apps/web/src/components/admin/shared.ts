import { LEAGUES } from '@sports/core';
import { ARTICLE_TAG_NAMES, articleTag } from '@/lib/article-tags';
import type { ArticleState } from '@/lib/articles';

export const STATE_TAG: Record<ArticleState, string> = {
  published: 'tag-accent',
  scheduled: 'tag-outline',
  draft: 'tag-neutral',
};
export const STATE_LABEL: Record<ArticleState, string> = {
  published: 'Published',
  scheduled: 'Scheduled',
  draft: 'Draft',
};

export const GENERAL = 'General';

/** "Premier League · Match report", as in the design's lists and preview. */
export function sectionLabel(leagueSlug: string | null, tag: string): string {
  const league = LEAGUES.find((l) => l.slug === leagueSlug)?.name ?? GENERAL;
  const key = articleTag(tag);
  const name = key ? ARTICLE_TAG_NAMES[key] : tag;
  return name ? `${league} · ${name}` : league;
}

/** Shape the console's lists use: plain data, safe to hand to client components. */
export interface ArticleListItem {
  id: string;
  title: string;
  section: string;
  author: string;
  updatedAt: string;
  views: number;
  comments: number;
  state: ArticleState;
}
