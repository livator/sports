import 'server-only';

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

/**
 * SQLite through libSQL. Locally this is a file; in production point DATABASE_URL at a
 * hosted libSQL/Turso database (with DATABASE_AUTH_TOKEN) and nothing else changes.
 */
function connect() {
  const url = process.env.DATABASE_URL?.trim() || 'file:./data/pitchside.db';
  if (url.startsWith('file:')) {
    mkdirSync(path.dirname(path.resolve(url.slice('file:'.length))), { recursive: true });
  }
  const authToken = process.env.DATABASE_AUTH_TOKEN?.trim();
  return drizzle(createClient({ url, ...(authToken ? { authToken } : {}) }), { schema });
}

let instance: ReturnType<typeof connect> | undefined;

/** Opened on first use, never at import time, so `next build` touches no database. */
export function getDb() {
  instance ??= connect();
  return instance;
}

let ready: Promise<void> | undefined;

/**
 * Applies pending migrations once per server process. Await this before the first query
 * on any code path, so a fresh checkout works without a manual setup step.
 */
export function dbReady(): Promise<void> {
  ready ??= migrate(getDb(), { migrationsFolder: path.join(process.cwd(), 'drizzle') }).catch(
    (error: unknown) => {
      ready = undefined;
      throw error;
    },
  );
  return ready;
}

export { schema };
