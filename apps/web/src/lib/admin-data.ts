import 'server-only';

import { LEAGUES } from '@sports/core';
import { and, count, desc, eq, gt, lte, max, sql, sum } from 'drizzle-orm';
import { dbReady, getDb, schema } from '@/db';
import { NEWS_SCOPE } from './comments';

const { user, session, comment, commentVote, article } = schema;

/** The console lists at most this many accounts, newest first. Beyond that it needs paging. */
export const ADMIN_USER_LIMIT = 500;

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  verified: boolean;
  suspended: boolean;
  suspendedReason: string | null;
  joinedAt: string;
  /** Last time one of the account's sessions was renewed; null when it has none. */
  lastActiveAt: string | null;
  comments: number;
  upvotesReceived: number;
}

export interface AdminUserComment {
  id: string;
  body: string;
  createdAt: string;
  /** Human label for the thread: a competition name, or "News". */
  where: string;
  href: string;
}

const DAY_MS = 24 * 60 * 60_000;

export async function listUsersForAdmin(): Promise<AdminUser[]> {
  await dbReady();
  const db = getDb();
  const [users, sessions, comments, votes] = await Promise.all([
    db.select().from(user).orderBy(desc(user.createdAt)).limit(ADMIN_USER_LIMIT),
    db
      .select({ userId: session.userId, at: max(session.updatedAt) })
      .from(session)
      .groupBy(session.userId),
    db.select({ userId: comment.userId, n: count() }).from(comment).groupBy(comment.userId),
    db
      .select({ userId: comment.userId, n: count() })
      .from(commentVote)
      .innerJoin(comment, eq(comment.id, commentVote.commentId))
      .groupBy(comment.userId),
  ]);
  const lastActive = new Map(sessions.map((s) => [s.userId, s.at]));
  const commentCount = new Map(comments.map((c) => [c.userId, c.n]));
  const voteCount = new Map(votes.map((v) => [v.userId, v.n]));
  const now = Date.now();

  return users.map((u) => {
    // A suspension with an end date lapses on its own; show it as the sign-in check sees it.
    const suspended = u.banned === true && (!u.banExpires || u.banExpires.getTime() > now);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role ?? 'user',
      verified: u.emailVerified,
      suspended,
      suspendedReason: suspended ? u.banReason : null,
      joinedAt: u.createdAt.toISOString(),
      lastActiveAt: lastActive.get(u.id)?.toISOString() ?? null,
      comments: commentCount.get(u.id) ?? 0,
      upvotesReceived: voteCount.get(u.id) ?? 0,
    };
  });
}

export async function recentCommentsBy(userId: string, limit = 5): Promise<AdminUserComment[]> {
  await dbReady();
  const rows = await getDb()
    .select()
    .from(comment)
    .where(eq(comment.userId, userId))
    .orderBy(desc(comment.createdAt))
    .limit(limit);
  return rows.map((row) => {
    const news = row.scope === NEWS_SCOPE;
    const league = LEAGUES.find((l) => l.slug === row.scope);
    return {
      id: row.id,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      where: news ? 'News' : (league?.name ?? row.scope),
      href: news ? `/news/${row.threadId}` : `/match/${row.scope}/${row.threadId}?tab=comments`,
    };
  });
}

export interface AdminOverview {
  users: number;
  activeToday: number;
  publishedArticles: number;
  articleViews: number;
  comments: number;
}

export async function getOverview(): Promise<AdminOverview> {
  await dbReady();
  const db = getDb();
  const now = new Date();
  const liveArticle = and(eq(article.status, 'published'), lte(article.publishedAt, now));
  const [[users], [active], [articles], [comments]] = await Promise.all([
    db.select({ n: count() }).from(user),
    db
      .select({ n: sql<number>`count(distinct ${session.userId})` })
      .from(session)
      .where(gt(session.updatedAt, new Date(now.getTime() - DAY_MS))),
    db
      .select({ n: count(), views: sum(article.views) })
      .from(article)
      .where(liveArticle),
    db.select({ n: count() }).from(comment),
  ]);
  return {
    users: users?.n ?? 0,
    activeToday: active?.n ?? 0,
    publishedArticles: articles?.n ?? 0,
    articleViews: Number(articles?.views ?? 0),
    comments: comments?.n ?? 0,
  };
}
