import 'server-only';

import { isLocale, type Locale } from '@sports/i18n';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { admin } from 'better-auth/plugins';
import { getDb, schema } from '@/db';
import { cleanDisplayName } from './display-name';
import { sendVerificationEmail } from './email';

/** Pulls the UI locale out of the page the user will land on after verifying (e.g. "/ro/match/..."). */
function localeFromVerificationUrl(url: string): Locale | undefined {
  try {
    const callback = new URL(url).searchParams.get('callbackURL') ?? '';
    const first = new URL(callback, 'http://local').pathname.split('/')[1];
    return isLocale(first) ? first : undefined;
  } catch {
    return undefined;
  }
}

const explicitUrl = (process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL)?.trim();
const isProduction = process.env.NODE_ENV === 'production';

const createAuth = () =>
  betterAuth({
    appName: 'Pitchside',
    // Left unset in development so any localhost port works; the request's own origin is used.
    ...(explicitUrl ? { baseURL: explicitUrl } : {}),
    trustedOrigins: [
      ...(explicitUrl ? [explicitUrl] : []),
      ...(isProduction ? [] : ['http://localhost:*', 'http://127.0.0.1:*']),
    ],
    database: drizzleAdapter(getDb(), {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // An account cannot sign in, and so cannot comment, until the address is confirmed.
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    emailVerification: {
      sendOnSignUp: true,
      // Logging in with an unconfirmed address sends a fresh link instead of a dead end.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        const locale = localeFromVerificationUrl(url);
        await sendVerificationEmail({
          to: user.email,
          name: user.name,
          url,
          ...(locale ? { locale } : {}),
        });
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      // Sessions are renewed at most hourly. The admin console reads that time as "last active",
      // so this is also how precise that column is.
      updateAge: 60 * 60,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 8 },
        '/sign-up/email': { window: 60 * 10, max: 8 },
        '/send-verification-email': { window: 60, max: 3 },
      },
    },
    advanced: { cookiePrefix: 'pitchside' },
    // Names are shown to everyone next to comments, so they are cleaned where they are stored.
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({ data: { ...user, name: cleanDisplayName(user.name) } }),
        },
        update: {
          before: async (user) =>
            'name' in user
              ? { data: { ...user, name: cleanDisplayName(user.name) } }
              : { data: user },
        },
      },
    },
    plugins: [
      // Roles and suspensions. A suspended ("banned") account cannot open a session, and
      // suspending one revokes the sessions it already has. Only the "admin" role may use it.
      admin({ defaultRole: 'user', adminRoles: ['admin'], bannedUserMessage: 'suspended' }),
      // Must stay last: lets server actions and route handlers set auth cookies.
      nextCookies(),
    ],
  });

let instance: ReturnType<typeof createAuth> | undefined;

/**
 * Built on first use rather than at import, so `next build` needs neither a database nor
 * BETTER_AUTH_SECRET. At runtime in production a missing secret still fails loudly.
 */
export function getAuth() {
  instance ??= createAuth();
  return instance;
}

export type Session = ReturnType<typeof createAuth>['$Infer']['Session'];
