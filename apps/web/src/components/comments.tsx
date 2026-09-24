'use client';

import {
  COMMENT_MAX_LENGTH,
  CommentRequestError,
  CommentsClient,
  threadKey,
  type CommentErrorCode,
  type CommentThread,
  type MatchComment,
} from '@sports/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { initialsOf } from '@/lib/view';
import { useAuthUi, useSessionUser } from './auth-dialog';
import { ConfirmDialog } from './confirm-dialog';

type ShownError = Exclude<CommentErrorCode, 'notFound'>;

/** sessionStorage: the thread whose comment box sent the reader to the log in window. */
const LOGIN_FROM_KEY = 'pitchside.loginFromComments';

/**
 * Comments for a match or an article. Anyone can read. Guests can write too: pressing "Post"
 * (or an upvote) opens the log in / create account dialog and the draft is kept.
 *
 * Logging in does not post the draft. It used to, and the text also stayed in the box, so a
 * second press on "Post" published the same comment twice. Now the text waits in the box and
 * the reader presses "Post" once, knowingly, under their own name.
 */
export function Comments({
  thread,
  closedNote,
}: {
  thread: CommentThread;
  /** Set when the thread takes no new comments; shown in place of the form. */
  closedNote?: string;
}) {
  const t = useTranslations('comments');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const { user } = useSessionUser();
  const { openAuth } = useAuthUi();
  const queryClient = useQueryClient();
  // A relative base keeps this safe during server rendering; the browser resolves it to this origin.
  const client = useMemo(() => new CommentsClient({ baseUrl: '' }), []);
  const key = threadKey(thread);
  // The viewer is part of the key: whose upvotes are highlighted depends on who is asking.
  const queryKey = useMemo(() => ['comments', key, user?.id ?? 'guest'] as const, [key, user?.id]);
  const draftKey = `pitchside.draft.${key}`;

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<ShownError | null>(null);
  // Set when the reader has just logged in from this box: the hint tells them what is left to do.
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const askToLogIn = () => {
    // Logging in reloads the page, so the note that it started here has to outlive this component.
    try {
      sessionStorage.setItem(LOGIN_FROM_KEY, key);
    } catch {
      // Storage blocked: the reader just does not get the hint.
    }
    openAuth({ reason: 'comment' });
  };
  useEffect(() => {
    if (!user) return;
    try {
      if (sessionStorage.getItem(LOGIN_FROM_KEY) !== key) return;
      sessionStorage.removeItem(LOGIN_FROM_KEY);
    } catch {
      return;
    }
    setJustLoggedIn(true);
    box.current?.focus();
  }, [user, key]);

  // Keep the draft across the log in dialog and the email verification round trip.
  useEffect(() => {
    try {
      setDraft(localStorage.getItem(draftKey) ?? '');
    } catch {
      // Storage blocked: the draft simply is not restored.
    }
  }, [draftKey]);

  const updateDraft = (value: string) => {
    setDraft(value);
    setError(null);
    try {
      if (value) localStorage.setItem(draftKey, value);
      else localStorage.removeItem(draftKey);
    } catch {
      // Ignore: see above.
    }
  };

  const comments = useQuery({
    queryKey,
    queryFn: () => client.list(thread),
    refetchInterval: 30_000,
  });

  const patch = (update: (list: MatchComment[]) => MatchComment[]) =>
    queryClient.setQueriesData<MatchComment[]>({ queryKey: ['comments', key] }, (old) =>
      old ? update(old) : old,
    );

  const fail = (err: unknown) => {
    const code = err instanceof CommentRequestError ? err.code : 'generic';
    setError(code === 'notFound' ? 'generic' : code);
    return code;
  };

  const post = useMutation({
    mutationFn: (body: string) => client.post(thread, body),
    onSuccess: (comment) => {
      // After a log in the viewer-specific list may not exist yet; refetch covers that case.
      patch((list) => [comment, ...list]);
      void queryClient.invalidateQueries({ queryKey: ['comments', key] });
      updateDraft('');
      setJustLoggedIn(false);
    },
    onError: (err) => {
      // The session ran out while they were writing.
      if (fail(err) === 'unauthorized') askToLogIn();
    },
  });

  // The comment the reader is being asked about before it goes for good.
  const [pendingDelete, setPendingDelete] = useState<MatchComment | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => client.remove(id),
    onSuccess: (_data, id) => {
      patch((list) => list.filter((c) => c.id !== id));
      setPendingDelete(null);
    },
    onError: fail,
  });

  const vote = useMutation({
    mutationFn: (id: string) => client.vote(id),
    onSuccess: (result, id) =>
      patch((list) => list.map((c) => (c.id === id ? { ...c, ...result } : c))),
    onError: fail,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return setError('empty');
    if ([...body].length > COMMENT_MAX_LENGTH) return setError('tooLong');
    if (!user) {
      // The guest has written a message: now ask them to log in or create an account.
      askToLogIn();
      return;
    }
    post.mutate(body);
  };

  const remaining = COMMENT_MAX_LENGTH - [...draft].length;

  return (
    <div>
      {closedNote ? (
        <p className="border-b-2 py-5 text-sm text-ink-2">{closedNote}</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3 border-b-2 pt-5 pb-7">
          <label className="sr-only" htmlFor="comment-body">
            {t('label')}
          </label>
          <textarea
            ref={box}
            id="comment-body"
            className="input min-h-[72px] resize-y"
            placeholder={thread.type === 'article' ? t('placeholderArticle') : t('placeholder')}
            value={draft}
            onChange={(e) => updateDraft(e.target.value)}
            maxLength={COMMENT_MAX_LENGTH * 2}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="submit" className="btn btn-primary" disabled={post.isPending}>
              {post.isPending ? t('posting') : t('post')}
            </button>
            <span className="text-[13px] text-ink-2">
              {user &&
                (justLoggedIn && draft.trim()
                  ? t('loggedInHint', { name: user.name })
                  : t('postingAs', { name: user.name }))}
              {remaining <= 100 && (
                <span className={`ml-2 tnum ${remaining < 0 ? 'text-accent-700' : 'text-ink-3'}`}>
                  {t('remaining', { count: remaining })}
                </span>
              )}
            </span>
          </div>
          {error && (
            <p role="alert" className="text-[13px] text-accent-700">
              {t(`errors.${error}`, { max: COMMENT_MAX_LENGTH })}
            </p>
          )}
        </form>
      )}

      {comments.isPending ? (
        <p className="py-6 text-sm text-ink-2">{t('loading')}</p>
      ) : comments.isError ? (
        <p className="py-6 text-sm text-ink-2">{t('loadFailed')}</p>
      ) : comments.data.length === 0 ? (
        <p className="py-6 text-[15px] text-ink-2">{t('empty')}</p>
      ) : (
        <ul>
          {comments.data.map((c) => {
            const mine = user?.id === c.author.id;
            return (
              <li
                key={c.id}
                className="grid grid-cols-[36px_minmax(0,1fr)_auto] gap-3.5 border-b py-5"
              >
                <span
                  aria-hidden
                  className={`grid size-9 place-items-center text-xs font-extrabold text-ground ${mine ? 'bg-accent' : 'bg-ink'}`}
                >
                  {initialsOf(c.author.name)}
                </span>
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2.5 text-[13px]">
                    <span className="font-bold">{c.author.name}</span>
                    {c.author.staff && <span className="tag tag-neutral">{t('staff')}</span>}
                    {mine && <span className="text-accent-700">{t('you')}</span>}
                    <time dateTime={c.createdAt} className="text-ink-3">
                      {format.relativeTime(
                        new Date(Math.min(new Date(c.createdAt).getTime(), now.getTime())),
                        now,
                      )}
                    </time>
                    {c.canDelete && (
                      <button
                        type="button"
                        className="cursor-pointer text-ink-3 hover:text-accent"
                        onClick={() => setPendingDelete(c)}
                        disabled={remove.isPending}
                      >
                        {t('delete')}
                      </button>
                    )}
                  </div>
                  <p className="text-[15px] leading-normal break-words whitespace-pre-wrap">
                    {c.body}
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={c.voted}
                  aria-label={c.voted ? t('removeUpvote') : t('upvote')}
                  title={mine ? t('errors.ownComment', { max: COMMENT_MAX_LENGTH }) : undefined}
                  disabled={mine || vote.isPending}
                  onClick={() => (user ? vote.mutate(c.id) : openAuth())}
                  className={`flex cursor-pointer flex-col items-center gap-0.5 self-start border px-2.5 py-1.5 tnum text-[13px] font-bold disabled:cursor-default disabled:opacity-50 ${
                    c.voted ? 'border-accent text-accent-700' : 'hover:bg-hover'
                  }`}
                >
                  <span aria-hidden className="text-[10px]">
                    ▲
                  </span>
                  {c.votes}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('confirmDeleteTitle')}
        confirmLabel={t('delete')}
        busyLabel={t('deleting')}
        cancelLabel={t('cancel')}
        busy={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      >
        <p>
          {pendingDelete && user?.id !== pendingDelete.author.id
            ? t('confirmDeleteOther', { name: pendingDelete.author.name })
            : t('confirmDeleteText')}
        </p>
      </ConfirmDialog>
    </div>
  );
}
