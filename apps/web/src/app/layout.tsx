import type { ReactNode } from 'react';

/** The real document lives in app/[locale]/layout.tsx, which needs the locale for <html lang>. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
