import { isOwnArticleId, type CommentThread } from '@sports/core';
import { NextResponse } from 'next/server';
import { error } from '@/lib/api';
import { getLiveArticle } from '@/lib/articles';
import { postToThread, readThread } from '@/lib/comment-routes';
import { isArticleId } from '@/lib/news';

type Ctx = { params: Promise<{ id: string }> };

async function resolve(params: Ctx['params']) {
  const { id } = await params;
  if (!isArticleId(id)) return null;
  return { type: 'article', articleId: id } satisfies CommentThread;
}

export async function GET(req: Request, { params }: Ctx) {
  const thread = await resolve(params);
  return thread ? readThread(req, thread) : error('Invalid article id', 400);
}

export async function POST(req: Request, { params }: Ctx) {
  const thread = await resolve(params);
  if (!thread) return error('Invalid article id', 400);
  // Our own articles must be live, and the editor may have closed the thread.
  if (isOwnArticleId(thread.articleId)) {
    // Only `commentsOpen` matters here; the language of the text is irrelevant.
    const article = await getLiveArticle(thread.articleId, 'en');
    if (!article) return error('No such article', 404);
    if (article.commentsOpen === false) {
      return NextResponse.json({ error: 'closed' }, { status: 403 });
    }
  }
  return postToThread(req, thread);
}
