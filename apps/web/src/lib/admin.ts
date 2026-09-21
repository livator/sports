import 'server-only';

import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { dbReady, getDb, schema } from '@/db';
import { getAuth, type Session } from './auth';

export const ADMIN_ROLE = 'admin';

/** The design's demo account. Only ever used outside production, see `adminCredentials`. */
const DEMO_ADMIN = { email: 'admin@pitchside.app', password: 'pitchside' } as const;

export interface AdminCredentials {
  email: string;
  password: string;
  /** True when these are the well-known demo values rather than the operator's own. */
  demo: boolean;
}

/**
 * The first admin account comes from ADMIN_EMAIL and ADMIN_PASSWORD. In development the
 * design's demo login stands in when they are unset. In production there is no fallback:
 * a password printed in a README must never open a live console.
 */
export function adminCredentials(): AdminCredentials | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) return { email, password, demo: false };
  if (process.env.NODE_ENV === 'production') return null;
  return { ...DEMO_ADMIN, demo: true };
}

async function seedAdmin(): Promise<void> {
  const credentials = adminCredentials();
  if (!credentials) return;
  await dbReady();
  const db = getDb();

  const [existing] = await db
    .select({ id: schema.user.id, role: schema.user.role, verified: schema.user.emailVerified })
    .from(schema.user)
    .where(eq(schema.user.email, credentials.email))
    .limit(1);

  if (existing) {
    // Someone could register the admin address before the operator does, but they cannot
    // confirm it. So only an address that was verified is ever promoted, and its password
    // is left alone.
    if (existing.role !== ADMIN_ROLE && existing.verified) {
      await db.update(schema.user).set({ role: ADMIN_ROLE }).where(eq(schema.user.id, existing.id));
    }
    return;
  }

  // The same steps better-auth's own admin plugin takes to create a user with a password.
  const ctx = await getAuth().$context;
  const user = await ctx.internalAdapter.createUser(
    { email: credentials.email, name: 'Admin', emailVerified: true, role: ADMIN_ROLE },
    { method: 'admin' },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: await ctx.password.hash(credentials.password),
  });
}

let seeded: Promise<void> | undefined;

/** Makes sure the first admin exists. Runs once per server process; retried if it fails. */
export function ensureAdminUser(): Promise<void> {
  seeded ??= seedAdmin().catch((error: unknown) => {
    seeded = undefined;
    throw error;
  });
  return seeded;
}

/** Not a type guard on purpose: a session that is not an admin's is still a session. */
export const isAdmin = (session: Session | null): boolean => session?.user.role === ADMIN_ROLE;

/** The current request's session, whoever it belongs to. */
export async function currentSession(): Promise<Session | null> {
  await dbReady();
  return getAuth().api.getSession({ headers: await headers() });
}

/**
 * Gate for every admin page and every admin action. The role is read from the database on
 * each call, so taking the role away (or suspending the account) locks the console at once.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await currentSession();
  if (!session || !isAdmin(session)) redirect('/admin/login');
  return session;
}
