import { NextResponse } from 'next/server';
import { error } from '@/lib/api';
import { CommentError, toggleVote } from '@/lib/comments';
import { getSession, isSameOrigin } from '@/lib/session';

type Ctx = { params: Promise<{ id: string }> };

/** Toggles the signed-in user's upvote on a comment. */
export async function POST(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return error('Cross-origin request refused', 403);
  const session = await getSession(req.headers);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    return NextResponse.json(await toggleVote((await params).id, session.user.id), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof CommentError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    console.error('[comments]', err);
    return error('Vote was not saved', 500);
  }
}
