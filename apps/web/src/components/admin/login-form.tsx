'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

type Problem = 'credentials' | 'notAdmin' | 'suspended' | 'tooMany' | 'generic';

const MESSAGES: Record<Problem, string> = {
  credentials: 'Wrong email or password.',
  notAdmin: 'This account has no access to the admin console.',
  suspended: 'This account is suspended.',
  tooMany: 'Too many attempts. Wait a minute and try again.',
  generic: 'That did not work. Try again.',
};

export function LoginForm({
  demo,
  signedInAs,
}: {
  demo: { email: string; password: string } | null;
  /** Email of a signed-in account that is not an admin, if any. */
  signedInAs: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<Problem | null>(signedInAs ? 'notAdmin' : null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    const { data, error } = await authClient.signIn.email({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setProblem(
        error.status === 429
          ? 'tooMany'
          : error.code === 'BANNED_USER'
            ? 'suspended'
            : error.status === 401 || error.status === 403
              ? 'credentials'
              : 'generic',
      );
      return;
    }
    // The server decides who is an admin; this only picks the message. A normal account that
    // signs in here is signed out again, so the console never leaves it logged in by surprise.
    const role = (data?.user as { role?: string | null } | undefined)?.role;
    if (role !== 'admin') {
      await authClient.signOut();
      setBusy(false);
      setProblem('notAdmin');
      return;
    }
    router.replace('/admin');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-[380px] flex-col gap-5">
      <div>
        <span className="mb-2.5 block text-[13px] tracking-[0.08em] text-accent-700 uppercase">
          Sign in
        </span>
        <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em]">
          Admin login
        </h1>
      </div>
      <div className="rule-2" />
      <div className="field">
        <label htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          className="input"
          type="email"
          autoComplete="username"
          placeholder="you@pitchside.app"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          className="input"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {problem && (
        <p role="alert" className="text-[13px] text-accent-700">
          {MESSAGES[problem]}
          {problem === 'notAdmin' && signedInAs ? ` (${signedInAs})` : ''}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      {demo && (
        <p className="text-[13px] text-ink-2">
          Demo credentials: {demo.email} · {demo.password}
          <br />
          Development only. Set ADMIN_EMAIL and ADMIN_PASSWORD before going live.
        </p>
      )}
    </form>
  );
}
