import 'server-only';

import { dbReady } from '@/db';
import { getAuth, type Session } from './auth';

/** The signed-in user for a request, or null. Unverified accounts never have a session. */
export async function getSession(headers: Headers): Promise<Session | null> {
  await dbReady();
  return getAuth().api.getSession({ headers });
}

/**
 * Rejects state-changing requests that a browser sent from another site. Auth cookies are
 * SameSite=Lax already; this is the second lock. Non-browser clients send no Origin and pass.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
