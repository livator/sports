import { NextResponse } from 'next/server';
import { error, isResponse, resolveLeague } from '@/lib/api';
import { CommentError, createComment, isValidMatchId, listComments } from '@/lib/comments';
import { getSession, isSameOrigin } from '@/lib/session';

type Ctx = { params: Promise<{ slug: string; id: string }> };

const NO_STORE = { 'Cache-Control': 'no-store' };

async function resolve(params: Ctx['params']) {
  const { slug, id } = await params;
  const league = resolveLeague(slug);
  if (isResponse(league)) return league;
  if (!isValidMatchId(id)) return error('Invalid match id', 400);
  return { league, id };
}

/** Anyone can read comments. */
export async function GET(_req: Request, { params }: Ctx) {
  const target = await resolve(params);
  if (isResponse(target)) return target;
  try {
    const comments = await listComments(target.league.slug, target.id);
    return NextResponse.json({ comments }, { headers: NO_STORE });
  } catch (err) {
    console.error('[comments]', err);
    return error('Comments are unavailable', 500);
  }
}

/** Only signed-in (and therefore email-verified) users can post. */
export async function POST(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return error('Cross-origin request refused', 403);
  const target = await resolve(params);
  if (isResponse(target)) return target;

  const session = await getSession(req.headers);
  if (!session)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });

  let body: unknown;
  try {
    body = ((await req.json()) as { body?: unknown }).body;
  } catch {
    return error('Expected JSON', 400);
  }
  if (typeof body !== 'string') return NextResponse.json({ error: 'empty' }, { status: 400 });

  try {
    const comment = await createComment({
      league: target.league.slug,
      matchId: target.id,
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
