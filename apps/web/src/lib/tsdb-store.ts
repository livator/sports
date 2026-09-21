import 'server-only';

import type { TheSportsDbEntry, TheSportsDbStore } from '@sports/core';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Keeps TheSportsDB's answers on disk, so a restart does not begin with an empty memory and
 * two minutes of request budget to win back. Beside the local database by default, which is
 * git-ignored; losing the folder only costs that warm-up.
 */
function cacheDir(): string {
  return path.resolve(process.env.TSDB_CACHE_DIR?.trim() || './data/cache/thesportsdb');
}

/** Keys are request URLs and contain the API key, so files are named by a hash of them. */
const fileFor = (key: string) =>
  path.join(cacheDir(), `${createHash('sha256').update(key).digest('hex').slice(0, 40)}.json`);

export const tsdbFileStore: TheSportsDbStore = {
  async read(key) {
    try {
      const entry = JSON.parse(await readFile(fileFor(key), 'utf8')) as Partial<TheSportsDbEntry>;
      return typeof entry.until === 'number' && 'value' in entry
        ? { until: entry.until, value: entry.value }
        : undefined;
    } catch {
      // Missing or unreadable: the same as never having asked.
      return undefined;
    }
  },

  async write(key, entry) {
    const file = fileFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    // Written beside the target and renamed into place, so a reader never sees half a file.
    const draft = `${file}.${randomBytes(4).toString('hex')}.tmp`;
    await writeFile(draft, JSON.stringify(entry));
    await rename(draft, file);
  },
};
