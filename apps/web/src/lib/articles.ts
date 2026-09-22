import 'server-only';

import { isLeagueSlug, OWN_ARTICLE_PREFIX, type LeagueSlug, type NewsArticle } from '@sports/core';
import { LOCALES, LOCALE_NAMES, type Locale } from '@sports/i18n';
import { and, count, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { dbReady, getDb, schema } from '@/db';
import { NEWS_SCOPE } from './comments';
import { env } from './env';
import { deleteUpload, isUploadPath } from './uploads';

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

/** The three text fields written per language. Everything else is shared. */
type LocalizedField = 'title' | 'summary' | 'body';

export interface ArticleInput {
  leagueSlug: LeagueSlug | null;
  tag: string;
  title: Record<Locale, string>;
  summary: Record<Locale, string>;
  body: Record<Locale, string>;
  author: string;
  imageUrl: string | null;
  caption: string;
  featured: boolean;
  commentsOn: boolean;
  /** When to go live. Null means "as soon as it is published". */
  publishAt: Date | null;
}

export type ArticleField =
  | 'leagueSlug'
  | 'tag'
  | 'author'
  | 'caption'
  | 'imageUrl'
  | 'publishAt'
  | `${LocalizedField}.${Locale}`;

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
 * Turns whatever the editor form sent into a clean `ArticleInput`, or throws naming the field
 * (and, for a localized one, which language). Everything here is rendered as text, never as
 * HTML, so there is nothing to sanitise beyond length and the image address.
 */
export function parseArticleInput(raw: Record<string, unknown>): ArticleInput {
  const shared = (name: 'tag' | 'author' | 'caption' | 'imageUrl', label: string): string => {
    const value = text(raw[name]).replace(/\s+/g, ' ').trim();
    if (value.length > ARTICLE_LIMITS[name]) {
      throw new ArticleInputError(
        name,
        `${label} can be up to ${ARTICLE_LIMITS[name]} characters.`,
      );
    }
    return value;
  };

  /** `title_en`, `title_ru`, `title_ro`, and so on: one input per language. */
  const localized = (
    base: LocalizedField,
    label: string,
    multiline = false,
  ): Record<Locale, string> => {
    const out = {} as Record<Locale, string>;
    for (const locale of LOCALES) {
      const value = multiline
        ? text(raw[`${base}_${locale}`]).replace(/\r\n/g, '\n').trim()
        : text(raw[`${base}_${locale}`]).replace(/\s+/g, ' ').trim();
      if (value.length > ARTICLE_LIMITS[base]) {
        throw new ArticleInputError(
          `${base}.${locale}`,
          `${label} (${LOCALE_NAMES[locale]}) can be up to ${ARTICLE_LIMITS[base]} characters.`,
        );
      }
      out[locale] = value;
    }
    return out;
  };

  const title = localized('title', 'The headline');
  if (!title.en) throw new ArticleInputError('title.en', 'An English headline is required.');
  const summary = localized('summary', 'The standfirst');
  const body = localized('body', 'The body', true);

  const league = text(raw.leagueSlug);
  if (league && !isLeagueSlug(league)) {
    throw new ArticleInputError('leagueSlug', 'Unknown competition.');
  }

  const imageUrl = shared('imageUrl', 'The photo address');
  // Either a photo uploaded in the console or an https address. Nothing else: the value ends
  // up in an <img src>, and "javascript:" or "data:" have no business there.
  if (imageUrl && !isUploadPath(imageUrl)) {
    let ok = false;
    try {
      ok = new URL(imageUrl).protocol === 'https:';
    } catch {
      // Not a URL at all.
    }
    if (!ok) {
      throw new ArticleInputError(
        'imageUrl',
        'Upload a photo, or use an address starting with https://',
      );
    }
  }

  const when = text(raw.publishAt);
  const publishAt = when ? new Date(when) : null;
  if (publishAt && Number.isNaN(publishAt.getTime())) {
    throw new ArticleInputError('publishAt', 'That publish time is not a valid date.');
  }

  return {
    leagueSlug: league && isLeagueSlug(league) ? league : null,
    tag: shared('tag', 'The tag'),
    title,
    summary,
    body,
    author: shared('author', 'The author'),
    imageUrl: imageUrl || null,
    caption: shared('caption', 'The caption'),
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

/** One title to show in the console's own lists, which are not written for a single reader. */
export function adminTitle(row: Pick<ArticleRow, 'titleEn' | 'titleRu' | 'titleRo'>): string {
  return row.titleEn || row.titleRu || row.titleRo || '(untitled)';
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
  if (opts.id && !existing) {
    throw new ArticleInputError('title.en', 'This article no longer exists.');
  }

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
    titleEn: input.title.en,
    titleRu: input.title.ru,
    titleRo: input.title.ro,
    summaryEn: input.summary.en,
    summaryRu: input.summary.ru,
    summaryRo: input.summary.ro,
    bodyEn: input.body.en,
    bodyRu: input.body.ru,
    bodyRo: input.body.ro,
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
    if (existing.imageUrl !== values.imageUrl) await dropUnusedUpload(existing.imageUrl);
    return { ...existing, ...values };
  }
  const row = { id: newId(), ...values, views: 0, createdAt: now };
  await db.insert(article).values(row);
  return row;
}

/** Deletes an uploaded photo once no article shows it any more. Outside addresses are left alone. */
async function dropUnusedUpload(imageUrl: string | null): Promise<void> {
  if (!imageUrl || !isUploadPath(imageUrl)) return;
  const [used] = await getDb()
    .select({ id: article.id })
    .from(article)
    .where(eq(article.imageUrl, imageUrl))
    .limit(1);
  if (!used) await deleteUpload(imageUrl);
}

/** Removes the article, its comment thread (votes go with the comments) and its uploaded photo. */
export async function deleteArticle(id: string): Promise<void> {
  await dbReady();
  const db = getDb();
  const existing = await getArticleForAdmin(id);
  await db.delete(comment).where(and(eq(comment.scope, NEWS_SCOPE), eq(comment.threadId, id)));
  await db.delete(article).where(eq(article.id, id));
  await dropUnusedUpload(existing?.imageUrl ?? null);
}

/* ---------- Public side ---------- */

const live = (now: Date) => and(eq(article.status, 'published'), lte(article.publishedAt, now));

/** The row's title/summary/body in the requested language, falling back to English when that
 * language has not been written yet. English itself is required (see `parseArticleInput`), so
 * there is always something to fall back to. */
function localizedText(row: ArticleRow, locale: Locale) {
  if (locale === 'en') return { title: row.titleEn, summary: row.summaryEn, body: row.bodyEn };
  const title = locale === 'ru' ? row.titleRu : row.titleRo;
  const summary = locale === 'ru' ? row.summaryRu : row.summaryRo;
  const body = locale === 'ru' ? row.bodyRu : row.bodyRo;
  return {
    title: title || row.titleEn,
    summary: summary || row.summaryEn,
    body: body || row.bodyEn,
  };
}

export function toNewsArticle(row: ArticleRow, locale: Locale): NewsArticle {
  const { title, summary, body } = localizedText(row, locale);
  return {
    id: row.id,
    title,
    summary,
    publishedAt: (row.publishedAt ?? row.updatedAt).toISOString(),
    ...(row.leagueSlug && isLeagueSlug(row.leagueSlug) ? { leagueSlug: row.leagueSlug } : {}),
    ...(row.tag ? { label: row.tag } : {}),
    ...(row.author ? { author: row.author } : {}),
    ...(row.imageUrl ? { imageUrl: row.imageUrl } : {}),
    ...(row.caption ? { imageCredit: row.caption } : {}),
    sourceName: 'Pitchside',
    sourceUrl: `${env.appUrl}/news/${row.id}`,
    body,
    featured: row.featured,
    commentsOpen: row.commentsOn,
  };
}

/** Live articles for a set of competitions. General stories (no competition) match any set. */
export async function listLiveArticles(
  leagues: readonly LeagueSlug[],
  limit: number,
  locale: Locale,
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
  return rows.map((row) => toNewsArticle(row, locale));
}

export async function getLiveArticle(id: string, locale: Locale): Promise<NewsArticle | null> {
  await dbReady();
  const [row] = await getDb()
    .select()
    .from(article)
    .where(and(eq(article.id, id), live(new Date())))
    .limit(1);
  return row ? toNewsArticle(row, locale) : null;
}

/** Counts one read of a live article. Anything else is ignored. */
export async function countView(id: string): Promise<void> {
  await dbReady();
  await getDb()
    .update(article)
    .set({ views: sql`${article.views} + 1` })
    .where(and(eq(article.id, id), live(new Date())));
}
