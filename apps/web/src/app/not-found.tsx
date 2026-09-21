import { NotFoundView } from '@/components/not-found-view';
import { archivo, cyrillic } from '@/lib/fonts';
import './globals.css';

/**
 * The last resort: requests that belong to neither the localized site nor the admin console,
 * such as a missing file with an extension. Those skip the locale middleware, so there is no
 * language to go by and the page is in English, with plain links (a full page load is right
 * here: this document is outside the app shell).
 */
export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${archivo.variable} ${cyrillic.variable}`}>
      <body>
        <main className="mx-auto w-full max-w-[1520px] px-[clamp(16px,4vw,48px)] pb-16">
          <NotFoundView
            kicker="Error 404"
            title="Offside"
            text="There’s no page at this address. It may have moved, or the link may be wrong."
            actions={
              <>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/" className="btn btn-primary">
                  Today’s matches
                </a>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/tables" className="btn btn-secondary">
                  Tables
                </a>
              </>
            }
          />
        </main>
      </body>
    </html>
  );
}
