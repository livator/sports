import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/login-form';
import { adminCredentials, currentSession, ensureAdminUser, isAdmin } from '@/lib/admin';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  await ensureAdminUser();
  const session = await currentSession();
  if (isAdmin(session)) redirect('/admin');

  const credentials = adminCredentials();
  return (
    <div className="grid flex-1 grid-cols-1 min-[900px]:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-[clamp(24px,5vw,64px)] text-ground min-[900px]:flex">
        <span className="flex items-center gap-2.5 text-lg font-extrabold">
          <span aria-hidden className="inline-block size-3 bg-accent" />
          Pitchside
        </span>
        <div>
          <span className="mb-4 block text-[13px] tracking-[0.08em] text-accent uppercase">
            Admin console
          </span>
          <p className="-ml-[0.04em] text-[clamp(36px,4.5vw,64px)] leading-none font-extrabold tracking-[-0.03em]">
            Publish news.
            <br />
            Know your fans.
          </p>
        </div>
        <span className="text-[13px] opacity-60">Restricted area · authorised staff only</span>
      </div>
      <div className="flex items-center justify-center p-[clamp(24px,5vw,64px)]">
        <LoginForm
          // Shown only while the well-known demo account is what opens the console, which
          // adminCredentials() never allows in production.
          demo={credentials?.demo ? credentials : null}
          signedInAs={session ? session.user.email : null}
        />
      </div>
    </div>
  );
}
