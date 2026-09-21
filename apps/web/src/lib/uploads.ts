import 'server-only';

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Photos for our own articles. Small enough to store as they come, big enough for a wide photo. */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

const TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;
type Extension = keyof typeof TYPES;

/** Public address of an upload. The name is ours: 32 hex characters and a known extension. */
const UPLOAD_PATH = /^\/uploads\/([a-f0-9]{32}\.(?:jpg|png|webp))$/;
const UPLOAD_NAME = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

export const isUploadPath = (value: string): boolean => UPLOAD_PATH.test(value);

/**
 * Where the files live. Beside the local database by default, so both are git-ignored and
 * backed up together. On a host without a persistent disk, point UPLOADS_DIR at a mounted volume.
 */
function uploadsDir(): string {
  return path.resolve(process.env.UPLOADS_DIR?.trim() || './data/uploads');
}

/**
 * What the file really is, read from its first bytes. The browser's word for it (and the
 * file name) is whatever the sender says, so neither is trusted. SVG is left out on purpose:
 * it can carry scripts.
 */
export function sniffImage(bytes: Uint8Array): Extension | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0xff, 0xd8, 0xff)) return 'jpg';
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
  const ascii = (from: number, text: string) =>
    [...text].every((ch, i) => bytes[from + i] === ch.charCodeAt(0));
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'webp';
  return null;
}

export class UploadError extends Error {
  constructor(
    readonly code: 'tooLarge' | 'notAnImage' | 'empty',
    message: string,
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

/** Stores an image under a random name and returns its public path, e.g. "/uploads/ab12….jpg". */
export async function saveUpload(bytes: Uint8Array): Promise<string> {
  if (bytes.length === 0) throw new UploadError('empty', 'The file is empty.');
  if (bytes.length > UPLOAD_MAX_BYTES) {
    throw new UploadError('tooLarge', 'The photo can be up to 5 MB.');
  }
  const extension = sniffImage(bytes);
  if (!extension) throw new UploadError('notAnImage', 'Use a JPEG, PNG or WebP image.');

  const name = `${randomBytes(16).toString('hex')}.${extension}`;
  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  // "wx": never overwrite. A clash of 32 random hex characters means something is wrong.
  await writeFile(path.join(dir, name), bytes, { flag: 'wx' });
  return `/uploads/${name}`;
}

/** The file behind a public name, or null. The name is checked, so it cannot leave the folder. */
export async function readUpload(
  name: string,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const match = UPLOAD_NAME.exec(name);
  if (!match) return null;
  try {
    const file = await readFile(path.join(uploadsDir(), name));
    // Node hands back a view into a shared pool; copy out exactly this file's bytes.
    const body = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    ) as ArrayBuffer;
    return { body, contentType: TYPES[match[1] as Extension] };
  } catch {
    return null;
  }
}

/** Removes an uploaded file. Anything that is not one of our upload paths is ignored. */
export async function deleteUpload(publicPath: string | null | undefined): Promise<void> {
  const match = publicPath ? UPLOAD_PATH.exec(publicPath) : null;
  if (!match?.[1]) return;
  await unlink(path.join(uploadsDir(), match[1])).catch(() => undefined);
}
