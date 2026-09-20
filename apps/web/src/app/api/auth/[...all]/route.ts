import { toNextJsHandler } from 'better-auth/next-js';
import { dbReady } from '@/db';
import { getAuth } from '@/lib/auth';

let handler: ReturnType<typeof toNextJsHandler> | undefined;

async function ready() {
  await dbReady();
  handler ??= toNextJsHandler(getAuth());
  return handler;
}

export async function GET(request: Request) {
  return (await ready()).GET(request);
}

export async function POST(request: Request) {
  return (await ready()).POST(request);
}
