'use client';

import { useTranslations } from 'next-intl';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { initialsOf, teamHref } from '@/lib/view';
import { useFavourites } from './favourites';

type Mode = 'login' | 'create';

interface OpenOptions {
  mode?: Mode;
  /** Why the dialog opened, shown above the form. */
  reason?: 'comment';
  /** Runs once the user is signed in (login only; new accounts must confirm their email first). */
  onSignedIn?: () => void;
}

interface AuthUiValue {
  openAuth: (options?: OpenOptions) => void;
  openAccount: () => void;
}

const AuthUiContext = createContext<AuthUiValue | null>(null);

export function useAuthUi(): AuthUiValue {
  const value = useContext(AuthUiContext);
  if (!value) throw new Error('useAuthUi must be used inside <AuthUiProvider>');
  return value;
}

/** The session, straight from better-auth. `user` is null while signed out or still loading. */
export function useSessionUser() {
  const { data, isPending } = authClient.useSession();
  return { user: data?.user ?? null, isPending };
}

export function AuthUiProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<OpenOptions | null>(null);
  const [account, setAccount] = useState(false);

  const value = useMemo<AuthUiValue>(
    () => ({
      openAuth: (options = {}) => setAuth(options),
      openAccount: () => setAccount(true),
    }),
    [],
  );

  return (
    <AuthUiContext.Provider value={value}>
      {children}
      {auth && <AuthDialog options={auth} onClose={() => setAuth(null)} />}
      {account && <AccountDialog onClose={() => setAccount(false)} />}
    </AuthUiContext.Provider>
  );
}

function Backdrop({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-[color-mix(in_srgb,var(--color-neutral-900)_50%,transparent)] p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="flex w-[min(440px,100%)] flex-col gap-4 bg-surface p-4 shadow-dialog"
      >
        {children}
      </div>
    </div>
  );
}

/** Maps better-auth's error codes onto our translated messages. */
type AuthErrorKey =
  | 'invalidCredentials'
  | 'userExists'
  | 'passwordTooShort'
  | 'passwordTooLong'
  | 'invalidEmail'
  | 'nameRequired'
  | 'tooManyRequests'
  | 'generic';

function errorKey(error: { code?: string | undefined; status?: number }): AuthErrorKey {
  if (error.status === 429) return 'tooManyRequests';
  switch (error.code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
    case 'INVALID_PASSWORD':
    case 'USER_NOT_FOUND':
    case 'CREDENTIAL_ACCOUNT_NOT_FOUND':
      return 'invalidCredentials';
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'userExists';
    case 'PASSWORD_TOO_SHORT':
      return 'passwordTooShort';
    case 'PASSWORD_TOO_LONG':
      return 'passwordTooLong';
    case 'INVALID_EMAIL':
      return 'invalidEmail';
    default:
      return 'generic';
  }
}

/** Where the verification link should bring the user back to: this page, flagged as verified. */
function verificationCallback(): string {
  const url = new URL(window.location.href);
  url.searchParams.set('verified', '1');
  return `${url.pathname}${url.search}`;
}

function AuthDialog({ options, onClose }: { options: OpenOptions; onClose: () => void }) {
  const t = useTranslations('auth');
  const [mode, setMode] = useState<Mode>(options.mode ?? 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorKey | null>(null);
  /** Set once a verification link has been sent: the form gives way to "check your email". */
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);
  const onSignedIn = useRef(options.onSignedIn);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setUnverified(false);
    if (mode === 'create' && !name.trim()) return setError('nameRequired');
    setBusy(true);
    try {
      if (mode === 'create') {
        const res = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
          callbackURL: verificationCallback(),
        });
        if (res.error) setError(errorKey(res.error));
        else setPendingEmail(email.trim());
      } else {
        const res = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: verificationCallback(),
        });
        if (res.error?.code === 'EMAIL_NOT_VERIFIED') {
          // better-auth has just sent a fresh link (sendOnSignIn).
          setUnverified(true);
          setPendingEmail(email.trim());
        } else if (res.error) setError(errorKey(res.error));
        else {
          onClose();
          onSignedIn.current?.();
        }
      }
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!pendingEmail || busy) return;
    setBusy(true);
    setResent(false);
    const res = await authClient.sendVerificationEmail({
      email: pendingEmail,
      callbackURL: verificationCallback(),
    });
    setBusy(false);
    if (res.error) setError(errorKey(res.error));
    else setResent(true);
  };

  if (pendingEmail) {
    return (
      <Backdrop labelledBy="auth-title" onClose={onClose}>
        <h2 id="auth-title" className="text-xl">
          {t('checkEmailTitle')}
        </h2>
        <p className="text-sm">
          {unverified ? t('notVerified') : t('checkEmailText', { email: pendingEmail })}
        </p>
        <p role="status" className="min-h-5 text-[13px] text-ink-2">
          {resent ? t('resent') : error ? t(`errors.${error}`) : ''}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={resend} disabled={busy}>
            {t('resend')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </Backdrop>
    );
  }

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => {
        setMode(value);
        setError(null);
      }}
      className={`-mb-px cursor-pointer border-b-2 pb-2 text-sm ${
        mode === value ? 'border-accent font-bold' : 'border-transparent text-ink-2 hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Backdrop labelledBy="auth-title" onClose={onClose}>
      <h2 id="auth-title" className="text-xl">
        {mode === 'login' ? t('titleLogIn') : t('titleCreate')}
      </h2>
      {options.reason === 'comment' && <p className="text-sm text-ink-2">{t('toComment')}</p>}
      <div role="tablist" className="flex gap-5 border-b">
        {tab('login', t('logIn'))}
        {tab('create', t('create'))}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === 'create' && (
          <label className="block">
            <span className="mb-[5px] block text-xs text-ink-2">{t('name')}</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              autoComplete="nickname"
              autoFocus
              maxLength={40}
              required
            />
          </label>
        )}
        <label className="block">
          <span className="mb-[5px] block text-xs text-ink-2">{t('email')}</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            autoFocus={mode === 'login'}
          />
        </label>
        <label className="block">
          <span className="mb-[5px] block text-xs text-ink-2">{t('password')}</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            minLength={mode === 'create' ? 8 : undefined}
            maxLength={128}
            required
          />
          {mode === 'create' && (
            <span className="mt-[5px] block text-xs text-ink-3">{t('passwordHint')}</span>
          )}
        </label>
        <p role="alert" className="min-h-5 text-[13px] text-accent-700">
          {error ? t(`errors.${error}`) : ''}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? t('working') : mode === 'login' ? t('submitLogIn') : t('submitCreate')}
          </button>
        </div>
      </form>
    </Backdrop>
  );
}

function AccountDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('account');
  const { user } = useSessionUser();
  const { favs, unfollow } = useFavourites();

  const signOut = useCallback(async () => {
    await authClient.signOut();
    onClose();
  }, [onClose]);

  return (
    <Backdrop labelledBy="account-title" onClose={onClose}>
      <h2 id="account-title" className="text-xl">
        {t('title')}
      </h2>
      {user && (
        <div className="flex items-center gap-3.5">
          <span className="grid size-11 flex-none place-items-center bg-ink text-sm font-extrabold text-ground">
            {initialsOf(user.name)}
          </span>
          <div className="min-w-0">
            <div className="truncate font-bold">{user.name}</div>
            <div className="truncate text-[13px] text-ink-2">{user.email}</div>
          </div>
        </div>
      )}
      <div>
        <div className="flex items-baseline justify-between pt-1.5 pb-2.5 eyebrow">
          <span>{t('yourClubs')}</span>
          <span className="text-xs font-normal tracking-normal text-ink-3 normal-case">
            {t('clubsFollowed', { count: favs.length })}
          </span>
        </div>
        <div className="rule-2" />
        {favs.map((club) => (
          <div
            key={club.id}
            className="flex items-center justify-between gap-3 border-b py-2.5 text-sm"
          >
            <Link
              href={teamHref(club.league, club.id)}
              onClick={onClose}
              className="font-semibold hover:text-accent"
            >
              {club.name}
            </Link>
            <button
              type="button"
              className="btn btn-ghost text-[13px]"
              onClick={() => unfollow(club.id)}
            >
              {t('remove')}
            </button>
          </div>
        ))}
        {favs.length === 0 && <p className="pt-3 text-sm text-ink-2">{t('noClubs')}</p>}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={signOut}>
          {t('signOut')}
        </button>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          {t('done')}
        </button>
      </div>
    </Backdrop>
  );
}
