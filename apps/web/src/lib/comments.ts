import 'server-only';

import { COMMENT_MAX_LENGTH, type LeagueSlug, type MatchComment } from '@sports/core';
import { and, count, desc, eq, gt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { dbReady, getDb, schema } from '@/db';

const { comment, user } = schema;

/** Most comments one account may post per minute, across all matches. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const PAGE_SIZE = 200;

export class CommentError extends Error {
  constructor(
    readonly code: 'empty' | 'tooLong' | 'tooFast' | 'notFound',
    readonly status: number,
  ) {
    super(code);
    this.name = 'CommentError';
  }
}

/** Match ids come from the data source; accept only what one could plausibly look like. */
export function isValidMatchId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

export async function listComments(league: LeagueSlug, matchId: string): Promise<MatchComment[]> {
  await dbReady();
  const rows = await getDb()
    .select({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      authorId: user.id,
      authorName: user.name,
    })
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(and(eq(comment.leagueSlug, league), eq(comment.matchId, matchId)))
    .orderBy(desc(comment.createdAt))
    .limit(PAGE_SIZE);

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    author: { id: r.authorId, name: r.authorName },
  }));
}

export async function countComments(league: LeagueSlug, matchId: string): Promise<number> {
  await dbReady();
  const [row] = await getDb()
    .select({ n: count() })
    .from(comment)
    .where(and(eq(comment.leagueSlug, league), eq(comment.matchId, matchId)));
  return row?.n ?? 0;
}

export async function createComment(input: {
  league: LeagueSlug;
  matchId: string;
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

  const row = {
    id: randomUUID(),
    leagueSlug: input.league,
    matchId: input.matchId,
    userId: input.author.id,
    body,
    createdAt: new Date(),
  };
  await getDb().insert(comment).values(row);
  return { id: row.id, body, createdAt: row.createdAt.toISOString(), author: input.author };
}

/** Deletes a comment only when it belongs to `userId`. */
export async function deleteComment(id: string, userId: string): Promise<void> {
  await dbReady();
  const deleted = await getDb()
    .delete(comment)
    .where(and(eq(comment.id, id), eq(comment.userId, userId)))
    .returning({ id: comment.id });
  if (deleted.length === 0) throw new CommentError('notFound', 404);
}
