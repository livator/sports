import { isOwnArticleId } from '@sports/core';
import { NextResponse } from 'next/server';
import { error } from '@/lib/api';
import { countView } from '@/lib/articles';
import { isSameOrigin } from '@/lib/session';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Counts a read of one of our own articles. Sent by the article page once per browser
 * session, so crawlers, link previews and refreshes do not inflate the number. It is a
 * rough figure for editors, not an audited metric.
 */
export async function POST(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return error('Cross-origin request refused', 403);
  const { id } = await params;
  if (!isOwnArticleId(id)) return error('Invalid article id', 400);
  await countView(id).catch((err: unknown) => console.error('[views]', err));
  return new NextResponse(null, { status: 204 });
}
