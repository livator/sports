import 'server-only';

import type { CommentThread } from '@sports/core';
import { NextResponse } from 'next/server';
import { error } from './api';
import { CommentError, createComment, listComments } from './comments';
import { getSession, isSameOrigin } from './session';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** GET for any thread. Anyone can read; a signed-in reader also learns what they upvoted. */
export async function readThread(req: Request, thread: CommentThread): Promise<NextResponse> {
  try {
    const session = await getSession(req.headers).catch(() => null);
    const comments = await listComments(thread, session?.user.id);
    return NextResponse.json({ comments }, { headers: NO_STORE });
  } catch (err) {
    console.error('[comments]', err);
    return error('Comments are unavailable', 500);
  }
}

/** POST for any thread. Only signed-in (and therefore email-verified) users can post. */
export async function postToThread(req: Request, thread: CommentThread): Promise<NextResponse> {
  if (!isSameOrigin(req)) return error('Cross-origin request refused', 403);
  const session = await getSession(req.headers);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = ((await req.json()) as { body?: unknown }).body;
  } catch {
    return error('Expected JSON', 400);
  }
  if (typeof body !== 'string') return NextResponse.json({ error: 'empty' }, { status: 400 });

  try {
    const comment = await createComment({
      thread,
      author: { id: session.user.id, name: session.user.name },
      body,
    });
    return NextResponse.json({ comment }, { status: 201, headers: NO_STORE });
  } catch (err) {
    if (err instanceof CommentError) {
      return NextResponse.json({ error: err.code }, { status: err.status, headers: NO_STORE });
    }
    console.error('[comments]', err);
    return error('Comment was not saved', 500);
  }
}
