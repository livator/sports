import { Archivo, Inter } from 'next/font/google';

// latin-ext covers Romanian diacritics. Archivo has no Cyrillic, so Inter's Cyrillic subset sits
// behind it in the font stack: Latin text and figures stay Archivo, Russian letters use Inter.
export const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});
export const cyrillic = Inter({
  subsets: ['cyrillic'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-cyrillic',
  display: 'swap',
  preload: false,
});
