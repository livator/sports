export function SiteFooter() {
  return (
    <footer className="border-t border-line py-8 text-sm text-ink-muted">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Pitchside · Football data for Europe’s top 5 leagues.</p>
        <p className="text-ink-faint">
          Data via{' '}
          <a
            className="underline decoration-line-strong underline-offset-4 hover:text-ink"
            href="https://www.football-data.org"
            target="_blank"
            rel="noreferrer"
          >
            football-data.org
          </a>{' '}
          when configured.
        </p>
      </div>
    </footer>
  );
}
