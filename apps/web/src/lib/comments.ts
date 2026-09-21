import 'server-only';

import { COMMENT_MAX_LENGTH, type CommentThread, type MatchComment } from '@sports/core';
import { and, count, desc, eq, gt, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { dbReady, getDb, schema } from '@/db';

const { comment, commentVote, user } = schema;

/** Most comments one account may post per minute, across all threads. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const PAGE_SIZE = 200;
/** `scope` value for article threads. Match threads use their competition slug. */
export const NEWS_SCOPE = 'news';

export class CommentError extends Error {
  constructor(
    readonly code: 'empty' | 'tooLong' | 'tooFast' | 'notFound' | 'ownComment',
    readonly status: number,
  ) {
    super(code);
    this.name = 'CommentError';
  }
}

/** Thread ids come from the data source; accept only what one could plausibly look like. */
export function isValidThreadId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

/** How a thread is stored: see the note on the `comment` table. */
function where(thread: CommentThread) {
  return thread.type === 'match'
    ? and(eq(comment.scope, thread.league), eq(comment.threadId, thread.matchId))
    : and(eq(comment.scope, NEWS_SCOPE), eq(comment.threadId, thread.articleId));
}

/** Newest first. `viewerId` marks which comments the signed-in user has upvoted. */
export async function listComments(
  thread: CommentThread,
  viewerId?: string,
): Promise<MatchComment[]> {
  await dbReady();
  const rows = await getDb()
    .select({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      authorId: user.id,
      authorName: user.name,
      authorRole: user.role,
      votes: sql<number>`(select count(*) from ${commentVote} where ${commentVote.commentId} = ${comment.id})`,
      voted: viewerId
        ? sql<number>`exists(select 1 from ${commentVote} where ${commentVote.commentId} = ${comment.id} and ${commentVote.userId} = ${viewerId})`
        : sql<number>`0`,
    })
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(where(thread))
    .orderBy(desc(comment.createdAt))
    .limit(PAGE_SIZE);

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    author: {
      id: r.authorId,
      name: r.authorName,
      ...(r.authorRole === 'admin' ? { staff: true } : {}),
    },
    votes: Number(r.votes),
    voted: Number(r.voted) === 1,
  }));
}

export async function countComments(thread: CommentThread): Promise<number> {
  await dbReady();
  const [row] = await getDb().select({ n: count() }).from(comment).where(where(thread));
  return row?.n ?? 0;
}

export async function createComment(input: {
  thread: CommentThread;
  author: { id: string; name: string };
  body: string;
}): Promise<MatchComment> {
  await dbReady();
  // Collapse runs of blank lines; keep single line breaks the author intended.
  const body = input.body
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!body) throw new CommentError('empty', 400);
  if ([...body].length > COMMENT_MAX_LENGTH) throw new CommentError('tooLong', 400);

  const [recent] = await getDb()
    .select({ n: count() })
    .from(comment)
    .where(
      and(
        eq(comment.userId, input.author.id),
        gt(comment.createdAt, new Date(Date.now() - RATE_WINDOW_MS)),
      ),
    );
  if ((recent?.n ?? 0) >= RATE_LIMIT) throw new CommentError('tooFast', 429);

  const { thread } = input;
  const row = {
    id: randomUUID(),
    scope: thread.type === 'match' ? thread.league : NEWS_SCOPE,
    threadId: thread.type === 'match' ? thread.matchId : thread.articleId,
    userId: input.author.id,
    body,
    createdAt: new Date(),
  };
  await getDb().insert(comment).values(row);
  return {
    id: row.id,
    body,
    createdAt: row.createdAt.toISOString(),
    author: input.author,
    votes: 0,
    voted: false,
  };
}

/** Deletes a comment (and its votes) only when it belongs to `userId`. */
export async function deleteComment(id: string, userId: string): Promise<void> {
  await dbReady();
  const db = getDb();
  const [own] = await db
    .select({ id: comment.id })
    .from(comment)
    .where(and(eq(comment.id, id), eq(comment.userId, userId)));
  if (!own) throw new CommentError('notFound', 404);
  // Explicit, so it holds even where SQLite foreign keys are switched off.
  await db.delete(commentVote).where(eq(commentVote.commentId, id));
  await db.delete(comment).where(eq(comment.id, id));
}

/** Adds the user's upvote, or removes it if it was already there. Nobody upvotes themselves. */
export async function toggleVote(
  commentId: string,
  userId: string,
): Promise<{ votes: number; voted: boolean }> {
  await dbReady();
  const db = getDb();
  const [target] = await db
    .select({ authorId: comment.userId })
    .from(comment)
    .where(eq(comment.id, commentId));
  if (!target) throw new CommentError('notFound', 404);
  if (target.authorId === userId) throw new CommentError('ownComment', 400);

  const mine = and(eq(commentVote.commentId, commentId), eq(commentVote.userId, userId));
  const removed = await db.delete(commentVote).where(mine).returning({ id: commentVote.commentId });
  const voted = removed.length === 0;
  if (voted) {
    // A double click can race two inserts; the primary key makes the second a no-op.
    await db
      .insert(commentVote)
      .values({ commentId, userId, createdAt: new Date() })
      .onConflictDoNothing();
  }
  const [row] = await db
    .select({ n: count() })
    .from(commentVote)
    .where(eq(commentVote.commentId, commentId));
  return { votes: row?.n ?? 0, voted };
}
