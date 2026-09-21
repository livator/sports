import { readUpload } from '@/lib/uploads';

type Ctx = { params: Promise<{ name: string }> };

/** Serves a photo uploaded in the admin console. Names are random and never reused. */
export async function GET(_req: Request, { params }: Ctx) {
  const upload = await readUpload((await params).name);
  if (!upload) return new Response('Not found', { status: 404 });
  return new Response(upload.body, {
    headers: {
      'Content-Type': upload.contentType,
      // The type was decided from the file's own bytes; tell browsers not to second-guess it.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
