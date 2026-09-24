/**
 * The tags an article can carry, picked from a list in the admin so every one has a name
 * in each language (`news.tags.<key>` in the messages). Stored as the key.
 */
export const ARTICLE_TAGS = [
  'match-report',
  'preview',
  'transfers',
  'rumours',
  'injuries',
  'interview',
  'analysis',
  'opinion',
] as const;
export type ArticleTag = (typeof ARTICLE_TAGS)[number];

/** English names, for the admin console. */
export const ARTICLE_TAG_NAMES: Record<ArticleTag, string> = {
  'match-report': 'Match report',
  preview: 'Preview',
  transfers: 'Transfers',
  rumours: 'Rumours',
  injuries: 'Injuries',
  interview: 'Interview',
  analysis: 'Analysis',
  opinion: 'Opinion',
};

/**
 * The key for a stored tag. Articles written before the list existed hold free text, so an
 * English name ("Transfers") maps to its key too; anything else is not a known tag.
 */
export function articleTag(stored: string | undefined | null): ArticleTag | null {
  const value = stored?.trim().toLowerCase();
  if (!value) return null;
  return (
    ARTICLE_TAGS.find((key) => key === value || ARTICLE_TAG_NAMES[key].toLowerCase() === value) ??
    null
  );
}
