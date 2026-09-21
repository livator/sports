import 'server-only';

import { isLeagueSlug, OWN_ARTICLE_PREFIX, type LeagueSlug, type NewsArticle } from '@sports/core';
import { and, count, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { dbReady, getDb, schema } from '@/db';
import { NEWS_SCOPE } from './comments';
import { env } from './env';

const { article, comment } = schema;

export type ArticleRow = typeof article.$inferSelect;
/** What an editor sees. "scheduled" is a published article whose time has not come yet. */
export type ArticleState = 'draft' | 'scheduled' | 'published';

export const ARTICLE_LIMITS = {
  title: 160,
  summary: 400,
  body: 20_000,
  tag: 40,
  author: 80,
  caption: 200,
  imageUrl: 500,
} as const;

export interface ArticleInput {
  leagueSlug: LeagueSlug | null;
  tag: string;
  title: string;
  summary: string;
  body: string;
  author: string;
  imageUrl: string | null;
  caption: string;
  featured: boolean;
  commentsOn: boolean;
  /** When to go live. Null means "as soon as it is published". */
  publishAt: Date | null;
}

export type ArticleField = keyof typeof ARTICLE_LIMITS | 'leagueSlug' | 'publishAt';
export class ArticleInputError extends Error {
  constructor(
    readonly field: ArticleField,
    message: string,
  ) {
    super(message);
    this.name = 'ArticleInputError';
  }
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * Turns whatever the editor form sent into a clean `ArticleInput`, or throws naming the field.
 * Everything here is rendered as text, never as HTML, so there is nothing to sanitise beyond
 * length and the image address.
 */
export function parseArticleInput(raw: Record<string, unknown>): ArticleInput {
  const field = (name: keyof typeof ARTICLE_LIMITS, label: string, multiline = false) => {
    const value = multiline
      ? text(raw[name]).replace(/\r\n/g, '\n').trim()
      : text(raw[name]).replace(/\s+/g, ' ').trim();
    if (value.length > ARTICLE_LIMITS[name]) {
      throw new ArticleInputError(
        name,
        `${label} can be up to ${ARTICLE_LIMITS[name]} characters.`,
      );
    }
    return value;
  };

  const title = field('title', 'The headline');
  if (!title) throw new ArticleInputError('title', 'A headline is required.');

  const league = text(raw.leagueSlug);
  if (league && !isLeagueSlug(league)) {
    throw new ArticleInputError('leagueSlug', 'Unknown competition.');
  }

  const imageUrl = field('imageUrl', 'The photo address');
  if (imageUrl) {
    let ok = false;
    try {
      ok = new URL(imageUrl).protocol === 'https:';
    } catch {
      // Not a URL at all.
    }
    if (!ok) throw new ArticleInputError('imageUrl', 'The photo address must start with https://');
  }

  const when = text(raw.publishAt);
  const publishAt = when ? new Date(when) : null;
  if (publishAt && Number.isNaN(publishAt.getTime())) {
    throw new ArticleInputError('publishAt', 'That publish time is not a valid date.');
  }

  return {
    leagueSlug: league && isLeagueSlug(league) ? league : null,
    tag: field('tag', 'The tag'),
    title,
    summary: field('summary', 'The standfirst'),
    body: field('body', 'The body', true),
    author: field('author', 'The author'),
    imageUrl: imageUrl || null,
    caption: field('caption', 'The caption'),
    featured: raw.featured === true,
    commentsOn: raw.commentsOn !== false,
    publishAt,
  };
}

export function articleState(row: Pick<ArticleRow, 'status' | 'publishedAt'>, now = new Date()) {
  if (row.status !== 'published') return 'draft' satisfies ArticleState;
  return row.publishedAt && row.publishedAt > now
    ? ('scheduled' satisfies ArticleState)
    : ('published' satisfies ArticleState);
}

const newId = () => OWN_ARTICLE_PREFIX + randomBytes(9).toString('hex').slice(0, 14);

/* ---------- Admin side ---------- */

export interface AdminArticle extends ArticleRow {
  state: ArticleState;
  comments: number;
}

export async function listArticlesForAdmin(): Promise<AdminArticle[]> {
  await dbReady();
  const db = getDb();
  const [rows, counts] = await Promise.all([
    db.select().from(article).orderBy(desc(article.updatedAt)).limit(500),
    db
      .select({ id: comment.threadId, n: count() })
      .from(comment)
      .where(eq(comment.scope, NEWS_SCOPE))
      .groupBy(comment.threadId),
  ]);
  const byId = new Map(counts.map((c) => [c.id, c.n]));
  const now = new Date();
  return rows.map((row) => ({
    ...row,
    state: articleState(row, now),
    comments: byId.get(row.id) ?? 0,
  }));
}

export async function getArticleForAdmin(id: string): Promise<ArticleRow | null> {
  await dbReady();
  const [row] = await getDb().select().from(article).where(eq(article.id, id)).limit(1);
  return row ?? null;
}

/**
 * Creates or updates an article. `publish: false` always saves a draft, which also takes a
 * live article off the site. Publishing keeps the original date on later edits, so fixing a
 * typo does not push an old story back to the top of the feed.
 */
export async function saveArticle(opts: {
  id: string | null;
  input: ArticleInput;
  publish: boolean;
  editorId: string;
}): Promise<ArticleRow> {
  await dbReady();
  const db = getDb();
  const now = new Date();
  const existing = opts.id ? await getArticleForAdmin(opts.id) : null;
  if (opts.id && !existing) throw new ArticleInputError('title', 'This article no longer exists.');

  // Already on the site: keep its date. A scheduled article whose time was cleared goes live now.
  const liveSince =
    existing?.status === 'published' && existing.publishedAt && existing.publishedAt <= now
      ? existing.publishedAt
      : null;
  const publishedAt = opts.publish ? (opts.input.publishAt ?? liveSince ?? now) : null;
  const { input } = opts;
  const values = {
    leagueSlug: input.leagueSlug,
    tag: input.tag,
    title: input.title,
    summary: input.summary,
    body: input.body,
    author: input.author,
    imageUrl: input.imageUrl,
    caption: input.caption,
    featured: input.featured,
    commentsOn: input.commentsOn,
    status: opts.publish ? ('published' as const) : ('draft' as const),
    publishedAt,
    editorId: opts.editorId,
    updatedAt: now,
  };

  if (existing) {
    await db.update(article).set(values).where(eq(article.id, existing.id));
    return { ...existing, ...values };
  }
  const row = { id: newId(), ...values, views: 0, createdAt: now };
  await db.insert(article).values(row);
  return row;
}

/** Removes the article and its comment thread (votes go with the comments). */
export async function deleteArticle(id: string): Promise<void> {
  await dbReady();
  const db = getDb();
  await db.delete(comment).where(and(eq(comment.scope, NEWS_SCOPE), eq(comment.threadId, id)));
  await db.delete(article).where(eq(article.id, id));
}

/* ---------- Public side ---------- */

const live = (now: Date) => and(eq(article.status, 'published'), lte(article.publishedAt, now));

export function toNewsArticle(row: ArticleRow): NewsArticle {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    publishedAt: (row.publishedAt ?? row.updatedAt).toISOString(),
    ...(row.leagueSlug && isLeagueSlug(row.leagueSlug) ? { leagueSlug: row.leagueSlug } : {}),
    ...(row.tag ? { label: row.tag } : {}),
    ...(row.author ? { author: row.author } : {}),
    ...(row.imageUrl ? { imageUrl: row.imageUrl } : {}),
    ...(row.caption ? { imageCredit: row.caption } : {}),
    sourceName: 'Pitchside',
    sourceUrl: `${env.appUrl}/news/${row.id}`,
    body: row.body,
    featured: row.featured,
    commentsOpen: row.commentsOn,
  };
}

/** Live articles for a set of competitions. General stories (no competition) match any set. */
export async function listLiveArticles(
  leagues: readonly LeagueSlug[],
  limit: number,
): Promise<NewsArticle[]> {
  await dbReady();
  const scope =
    leagues.length > 0
      ? or(isNull(article.leagueSlug), inArray(article.leagueSlug, [...leagues]))
      : undefined;
  const rows = await getDb()
    .select()
    .from(article)
    .where(and(live(new Date()), scope))
    .orderBy(desc(article.featured), desc(article.publishedAt))
    .limit(limit);
  return rows.map(toNewsArticle);
}

export async function getLiveArticle(id: string): Promise<NewsArticle | null> {
  await dbReady();
  const [row] = await getDb()
    .select()
    .from(article)
    .where(and(eq(article.id, id), live(new Date())))
    .limit(1);
  return row ? toNewsArticle(row) : null;
}

/** Counts one read of a live article. Anything else is ignored. */
export async function countView(id: string): Promise<void> {
  await dbReady();
  await getDb()
    .update(article)
    .set({ views: sql`${article.views} + 1` })
    .where(and(eq(article.id, id), live(new Date())));
}
