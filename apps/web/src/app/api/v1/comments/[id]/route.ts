import { NextResponse } from 'next/server';
import { error } from '@/lib/api';
import { CommentError, deleteComment } from '@/lib/comments';
import { getSession, isSameOrigin } from '@/lib/session';

type Ctx = { params: Promise<{ id: string }> };

/** Authors can delete their own comments. */
export async function DELETE(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return error('Cross-origin request refused', 403);
  const session = await getSession(req.headers);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    await deleteComment((await params).id, session.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof CommentError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    console.error('[comments]', err);
    return error('Comment was not deleted', 500);
  }
}
