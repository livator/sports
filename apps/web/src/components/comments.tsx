'use client';

import {
  COMMENT_MAX_LENGTH,
  CommentRequestError,
  CommentsClient,
  type CommentErrorCode,
  type LeagueSlug,
  type MatchComment,
} from '@sports/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { initialsOf } from '@/lib/view';
import { useAuthUi, useSessionUser } from './auth-dialog';

type ShownError = Exclude<CommentErrorCode, 'notFound'>;

const draftKey = (league: string, matchId: string) => `pitchside.draft.${league}.${matchId}`;

/**
 * Comments for one match. Anyone can read. Guests can write too: pressing "Post" opens the
 * log in / create account dialog, the draft is kept, and after logging in it is posted.
 */
export function Comments({ league, matchId }: { league: LeagueSlug; matchId: string }) {
  const t = useTranslations('comments');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const { user } = useSessionUser();
  const { openAuth } = useAuthUi();
  const queryClient = useQueryClient();
  // A relative base keeps this safe during server rendering; the browser resolves it to this origin.
  const client = useMemo(() => new CommentsClient({ baseUrl: '' }), []);
  const queryKey = useMemo(() => ['comments', league, matchId] as const, [league, matchId]);

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<ShownError | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Keep the draft across the log in dialog and the email verification round trip.
  useEffect(() => {
    try {
      setDraft(localStorage.getItem(draftKey(league, matchId)) ?? '');
    } catch {
      // Storage blocked: the draft simply is not restored.
    }
  }, [league, matchId]);

  const updateDraft = (value: string) => {
    setDraft(value);
    setError(null);
    try {
      if (value) localStorage.setItem(draftKey(league, matchId), value);
      else localStorage.removeItem(draftKey(league, matchId));
    } catch {
      // Ignore: see above.
    }
  };

  const comments = useQuery({
    queryKey,
    queryFn: () => client.list(league, matchId),
    refetchInterval: 30_000,
  });

  const post = useMutation({
    mutationFn: (body: string) => client.post(league, matchId, body),
    onSuccess: (comment) => {
      queryClient.setQueryData<MatchComment[]>(queryKey, (old = []) => [comment, ...old]);
      updateDraft('');
    },
    onError: (err) => {
      const code = err instanceof CommentRequestError ? err.code : 'generic';
      if (code === 'unauthorized') {
        openAuth({ reason: 'comment', onSignedIn: () => post.mutate(draftRef.current) });
      }
      setError(code === 'notFound' ? 'generic' : code);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => client.remove(id),
    onSuccess: (_data, id) =>
      queryClient.setQueryData<MatchComment[]>(queryKey, (old = []) =>
        old.filter((c) => c.id !== id),
      ),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return setError('empty');
    if ([...body].length > COMMENT_MAX_LENGTH) return setError('tooLong');
    if (!user) {
      // The guest has written a message: now ask them to log in or create an account.
      openAuth({ reason: 'comment', onSignedIn: () => post.mutate(draftRef.current.trim()) });
      return;
    }
    post.mutate(body);
  };

  const remaining = COMMENT_MAX_LENGTH - [...draft].length;

  return (
    <div className="max-w-[720px] pt-8">
      <form onSubmit={submit} className="flex flex-col gap-3 border-b-2 pb-7">
        <label className="sr-only" htmlFor="comment-body">
          {t('label')}
        </label>
        <textarea
          id="comment-body"
          className="input min-h-[72px] resize-y"
          placeholder={t('placeholder')}
          value={draft}
          onChange={(e) => updateDraft(e.target.value)}
          maxLength={COMMENT_MAX_LENGTH * 2}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-ink-2">
            {user ? t('postingAs', { name: user.name }) : t('guestHint')}
            {remaining <= 100 && (
              <span className={`ml-2 tnum ${remaining < 0 ? 'text-accent-700' : 'text-ink-3'}`}>
                {t('remaining', { count: remaining })}
              </span>
            )}
          </span>
          <button type="submit" className="btn btn-primary" disabled={post.isPending}>
            {post.isPending ? t('posting') : t('post')}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-[13px] text-accent-700">
            {t(`errors.${error}`, { max: COMMENT_MAX_LENGTH })}
          </p>
        )}
      </form>

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
              <li key={c.id} className="grid grid-cols-[36px_minmax(0,1fr)] gap-3.5 border-b py-5">
                <span
                  aria-hidden
                  className={`grid size-9 place-items-center text-xs font-extrabold text-ground ${mine ? 'bg-accent' : 'bg-ink'}`}
                >
                  {initialsOf(c.author.name)}
                </span>
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2.5 text-[13px]">
                    <span className="font-bold">{c.author.name}</span>
                    {mine && <span className="text-accent-700">{t('you')}</span>}
                    <time dateTime={c.createdAt} className="text-ink-3">
                      {format.relativeTime(new Date(c.createdAt), now)}
                    </time>
                    {mine && (
                      <button
                        type="button"
                        className="ml-auto cursor-pointer text-ink-3 hover:text-accent"
                        onClick={() => remove.mutate(c.id)}
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
