import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { getSession, isSameOrigin } from '@/lib/session';
import { saveUpload, UPLOAD_MAX_BYTES, UploadError } from '@/lib/uploads';

const refuse = (error: string, message: string, status: number) =>
  NextResponse.json({ error, message }, { status });

/**
 * Photo upload for the article editor: one file in a multipart field called "photo".
 * Admins only, same origin only. The file is checked by its contents, never by its name.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return refuse('forbidden', 'Cross-origin request refused.', 403);
  const session = await getSession(req.headers);
  if (!session || !isAdmin(session)) return refuse('forbidden', 'Admins only.', 403);

  // Turn an oversized body away before reading it. The exact size is checked again below.
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > UPLOAD_MAX_BYTES + 64 * 1024) {
    return refuse('tooLarge', 'The photo can be up to 5 MB.', 413);
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get('photo');
  } catch {
    return refuse('empty', 'Expected a photo.', 400);
  }
  if (!(file instanceof File)) return refuse('empty', 'Expected a photo.', 400);

  try {
    const path = await saveUpload(new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({ path }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) {
      return refuse(error.code, error.message, error.code === 'tooLarge' ? 413 : 400);
    }
    console.error('[uploads]', error);
    return refuse('failed', 'The photo was not saved. Try again.', 500);
  }
}
