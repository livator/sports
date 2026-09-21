import type { CommentThread } from '@sports/core';
import { error } from '@/lib/api';
import { postToThread, readThread } from '@/lib/comment-routes';

type Ctx = { params: Promise<{ id: string }> };

/** Article ids are numeric at the source; anything else is not a thread. */
async function resolve(params: Ctx['params']) {
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) return null;
  return { type: 'article', articleId: id } satisfies CommentThread;
}

export async function GET(req: Request, { params }: Ctx) {
  const thread = await resolve(params);
  return thread ? readThread(req, thread) : error('Invalid article id', 400);
}

export async function POST(req: Request, { params }: Ctx) {
  const thread = await resolve(params);
  return thread ? postToThread(req, thread) : error('Invalid article id', 400);
}
