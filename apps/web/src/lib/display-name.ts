/** Longest display name. Long enough for a real name, short enough not to break a layout. */
export const DISPLAY_NAME_MAX = 40;

/**
 * A display name as it will be stored. The sign-up form can be bypassed, so this runs on the
 * server for every new account and every rename.
 *
 * - NFKC folds look-alike forms (full-width letters and the like) into the ordinary ones.
 * - Control and format characters go: they are invisible, and the direction overrides among
 *   them can make a name read as something it is not.
 * - Whitespace is collapsed, and the result is cut to DISPLAY_NAME_MAX characters.
 */
export function cleanDisplayName(value: unknown): string {
  const name = (typeof value === 'string' ? value : '')
    .normalize('NFKC')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [...name].slice(0, DISPLAY_NAME_MAX).join('').trim() || 'Fan';
}
