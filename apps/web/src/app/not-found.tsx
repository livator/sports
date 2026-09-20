import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="font-display text-7xl font-bold text-ink-faint">404</p>
      <h1 className="mt-2 font-display text-2xl font-semibold">Offside</h1>
      <p className="mt-2 text-ink-muted">That page isn’t on the team sheet.</p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-pitch-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-pitch-400"
      >
        Back to kick-off
      </Link>
    </div>
  );
}
