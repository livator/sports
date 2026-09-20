import { describe, expect, it } from 'vitest';
import { LOCALES, LOCALE_NAMES, LOCALE_TAGS, isLocale, loadMessages } from '../index';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** Top-level ICU argument names: {name}, {count, plural, ...}. Nested plural branches are skipped. */
function argumentNames(message: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    const ch = message[i];
    if (ch === '{') {
      if (depth === 0) {
        const match = /^\{\s*([a-zA-Z_][\w]*)/.exec(message.slice(i));
        if (match?.[1]) names.add(match[1]);
      }
      depth++;
    } else if (ch === '}') depth--;
  }
  return [...names].sort();
}

describe('message catalogs', () => {
  it('declares a name and an Intl tag for every locale', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_NAMES[locale]).toBeTruthy();
      expect(() => new Intl.DateTimeFormat(LOCALE_TAGS[locale])).not.toThrow();
    }
    expect(isLocale('ro')).toBe(true);
    expect(isLocale('de')).toBe(false);
  });

  it('every locale has exactly the keys of the English source', async () => {
    const source = flatten((await loadMessages('en')) as unknown as Tree);
    for (const locale of LOCALES) {
      const keys = [...flatten((await loadMessages(locale)) as unknown as Tree).keys()].sort();
      expect(keys, `keys of ${locale}`).toEqual([...source.keys()].sort());
    }
  });

  it('every translation uses the same placeholders as the source and is not empty', async () => {
    const source = flatten((await loadMessages('en')) as unknown as Tree);
    for (const locale of LOCALES) {
      const messages = flatten((await loadMessages(locale)) as unknown as Tree);
      for (const [key, english] of source) {
        const translated = messages.get(key) ?? '';
        expect(translated.trim().length, `${locale}:${key} is empty`).toBeGreaterThan(0);
        expect(argumentNames(translated), `${locale}:${key} placeholders`).toEqual(
          argumentNames(english),
        );
      }
    }
  });

  it('plural messages are balanced ICU', async () => {
    for (const locale of LOCALES) {
      for (const [key, message] of flatten((await loadMessages(locale)) as unknown as Tree)) {
        const opens = message.split('{').length;
        const closes = message.split('}').length;
        expect(opens, `${locale}:${key} has unbalanced braces`).toBe(closes);
      }
    }
  });
});
