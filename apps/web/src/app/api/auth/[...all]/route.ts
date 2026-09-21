import { toNextJsHandler } from 'better-auth/next-js';
import { dbReady } from '@/db';
import { ensureAdminUser } from '@/lib/admin';
import { getAuth } from '@/lib/auth';

let handler: ReturnType<typeof toNextJsHandler> | undefined;

async function ready() {
  await dbReady();
  // Before any log in is handled: in production this locks the demo admin account if a
  // development database brought it along. Opening /admin would do it too, but that account
  // can log in here without ever going there.
  await ensureAdminUser().catch((error: unknown) => console.error('[admin] setup failed', error));
  handler ??= toNextJsHandler(getAuth());
  return handler;
}

export async function GET(request: Request) {
  return (await ready()).GET(request);
}

export async function POST(request: Request) {
  return (await ready()).POST(request);
}
