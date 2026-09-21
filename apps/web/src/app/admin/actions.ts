'use server';

import { isOwnArticleId } from '@sports/core';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getDb, schema } from '@/db';
import { ADMIN_ROLE, requireAdmin } from '@/lib/admin';
import {
  ArticleInputError,
  articleState,
  deleteArticle,
  parseArticleInput,
  saveArticle,
  type ArticleField,
  type ArticleState,
} from '@/lib/articles';
import { getAuth } from '@/lib/auth';

/*
 * Every action starts with requireAdmin(): server actions are public HTTP endpoints, so the
 * page that renders the button being admin-only protects nothing by itself. Next.js already
 * rejects server actions posted from another origin.
 */

export type SaveArticleResult =
  | { ok: true; id: string; state: ArticleState; savedAt: string }
  | { ok: false; field?: ArticleField; message: string };

export async function saveArticleAction(payload: {
  id: string | null;
  publish: boolean;
  fields: Record<string, unknown>;
}): Promise<SaveArticleResult> {
  const session = await requireAdmin();
  if (payload.id !== null && !isOwnArticleId(payload.id)) {
    return { ok: false, message: 'Unknown article.' };
  }
  try {
    const row = await saveArticle({
      id: payload.id,
      input: parseArticleInput(payload.fields),
      publish: payload.publish === true,
      editorId: session.user.id,
    });
    revalidatePath('/admin', 'layout');
    return {
      ok: true,
      id: row.id,
      state: articleState(row),
      savedAt: row.updatedAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof ArticleInputError) {
      return { ok: false, field: error.field, message: error.message };
    }
    console.error('[admin] save article', error);
    return { ok: false, message: 'The article was not saved. Try again.' };
  }
}

export async function deleteArticleAction(id: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  if (!isOwnArticleId(id)) return { ok: false };
  await deleteArticle(id);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export type SuspendResult = { ok: true } | { ok: false; message: string };

/** Suspends or restores an account. Suspending also signs the user out everywhere. */
export async function setSuspendedAction(
  userId: string,
  suspended: boolean,
): Promise<SuspendResult> {
  const session = await requireAdmin();
  if (typeof userId !== 'string' || userId.length > 64) {
    return { ok: false, message: 'Unknown user.' };
  }
  if (userId === session.user.id) {
    return { ok: false, message: 'You cannot suspend your own account.' };
  }
  const [target] = await getDb()
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  if (!target) return { ok: false, message: 'Unknown user.' };
  if (target.role === ADMIN_ROLE) {
    return { ok: false, message: 'Admin accounts cannot be suspended from the console.' };
  }

  try {
    const api = getAuth().api;
    const request = { body: { userId }, headers: await headers() };
    if (suspended) {
      await api.banUser({ ...request, body: { userId, banReason: 'Suspended by an admin' } });
    } else {
      await api.unbanUser(request);
    }
    revalidatePath('/admin', 'layout');
    return { ok: true };
  } catch (error) {
    console.error('[admin] suspend', error);
    return { ok: false, message: 'That did not work. Try again.' };
  }
}
