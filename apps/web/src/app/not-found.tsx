/**
 * Only reached for requests the locale middleware does not handle (for example a missing
 * file with an extension). Pages under a locale use app/[locale]/not-found.tsx instead.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          padding: 32,
          background: '#fbfaf8',
          color: '#201e1d',
        }}
      >
        <h1 style={{ fontSize: 32, margin: 0 }}>404</h1>
        <p>
          {/* A full page load is intended: this page renders outside the localized app shell. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          Nothing here. <a href="/">Go to today’s matches</a>.
        </p>
      </body>
    </html>
  );
}
