import { AdminNav } from '@/components/admin/admin-nav';
import { ensureAdminUser, requireAdmin } from '@/lib/admin';

// Every console page reads the database and the session. Nothing here is ever prerendered.
export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  await ensureAdminUser();
  // Layouts do not re-run on every navigation, so each page and action calls requireAdmin()
  // too. This one is what sends a signed-out visitor to the login screen.
  const session = await requireAdmin();

  return (
    <>
      <AdminNav userName={session.user.name} />
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-[clamp(16px,4vw,48px)] pb-16">
        {children}
      </main>
      <footer className="border-t-2">
        <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-3 px-[clamp(16px,4vw,48px)] py-6 text-[13px] text-ink-2">
          <span>Pitchside admin console</span>
          <span>Signed in as {session.user.email}</span>
        </div>
      </footer>
    </>
  );
}
