import type { CommentThread } from '@sports/core';
import { error, isResponse, resolveLeague } from '@/lib/api';
import { postToThread, readThread } from '@/lib/comment-routes';
import { isValidThreadId } from '@/lib/comments';

type Ctx = { params: Promise<{ slug: string; id: string }> };

async function resolve(params: Ctx['params']) {
  const { slug, id } = await params;
  const league = resolveLeague(slug);
  if (isResponse(league)) return league;
  if (!isValidThreadId(id)) return error('Invalid match id', 400);
  return { type: 'match', league: league.slug, matchId: id } satisfies CommentThread;
}

export async function GET(req: Request, { params }: Ctx) {
  const thread = await resolve(params);
  return isResponse(thread) ? thread : readThread(req, thread);
}

export async function POST(req: Request, { params }: Ctx) {
  const thread = await resolve(params);
  return isResponse(thread) ? thread : postToThread(req, thread);
}
