'use client';

import { archivo, cyrillic } from '@/lib/fonts';
import './globals.css';

/**
 * The last line of defence: an error thrown by the locale layout itself (or by anything above
 * it) never reaches `[locale]/error.tsx`, because that boundary lives inside the layout that
 * failed. This replaces the whole document, so it brings its own `<html>` and `<body>`, and it
 * is in English: the locale is part of what may have failed to load.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en" className={`${archivo.variable} ${cyrillic.variable}`}>
      <body>
        <main className="mx-auto w-full max-w-[1520px] px-[clamp(16px,4vw,48px)] pb-16">
          <section className="max-w-[640px] pt-[clamp(40px,8vw,96px)]">
            <span className="mb-3 block kicker">Error</span>
            <h1 className="-ml-[0.04em] text-[clamp(56px,11vw,136px)] leading-[0.92] font-extrabold tracking-[-0.04em]">
              Stoppage
              <span className="text-accent">.</span>
            </h1>
            <div className="mt-8 rule-2" />
            <p className="pt-6 text-[19px] leading-[1.5] text-ink-2">
              Something went wrong at our end. The scores are still being played out — try again in
              a moment.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-7">
              <button type="button" onClick={reset} className="btn btn-primary">
                Try again
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="btn btn-secondary">
                Today’s matches
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
