'use client';

import { LEAGUES } from '@sports/core';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { saveArticleAction } from '@/app/admin/actions';
import { formatDayTime, toLocalInputValue } from '@/lib/admin-format';
import type { ArticleField, ArticleState } from '@/lib/articles';
import { GENERAL, sectionLabel, STATE_LABEL } from './shared';

export interface EditorArticle {
  id: string;
  state: ArticleState;
  updatedAt: string;
  publishedAt: string | null;
  leagueSlug: string | null;
  tag: string;
  title: string;
  summary: string;
  body: string;
  author: string;
  imageUrl: string;
  caption: string;
  featured: boolean;
  commentsOn: boolean;
}

/** Mirrors ARTICLE_LIMITS on the server, which has the final say. */
const LIMITS = { title: 160, summary: 400, body: 20_000, tag: 40, author: 80, caption: 200 };
const WORDS_PER_MINUTE = 220;

/** A photo uploaded here ("/uploads/…") or an https address, as the server will accept it. */
const isPhotoAddress = (value: string) => {
  if (/^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(value)) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export function ArticleEditor({
  article,
  defaultAuthor,
}: {
  article: EditorArticle | null;
  defaultAuthor: string;
}) {
  const [id, setId] = useState(article?.id ?? null);
  const [state, setState] = useState<ArticleState | null>(article?.state ?? null);
  const [savedAt, setSavedAt] = useState(article?.updatedAt ?? null);
  const [fields, setFields] = useState({
    leagueSlug: article?.leagueSlug ?? '',
    tag: article?.tag ?? '',
    title: article?.title ?? '',
    summary: article?.summary ?? '',
    body: article?.body ?? '',
    author: article?.author ?? defaultAuthor,
    imageUrl: article?.imageUrl ?? '',
    caption: article?.caption ?? '',
    featured: article?.featured ?? false,
    commentsOn: article?.commentsOn ?? true,
    // Filled in after mount: the value is in the editor's own timezone, which the server
    // cannot know.
    publishAt: '',
  });
  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState<{ text: string; field?: ArticleField } | null>(null);
  const [savedLabel, setSavedLabel] = useState('');
  const [busy, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const filePicker = useRef<HTMLInputElement>(null);

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    if (file.size > PHOTO_MAX_BYTES) {
      setNote({ text: 'The photo can be up to 5 MB.', field: 'imageUrl' });
      return;
    }
    setUploading(true);
    setNote(null);
    try {
      const body = new FormData();
      body.append('photo', file);
      const res = await fetch('/api/admin/uploads', { method: 'POST', body });
      const data = (await res.json().catch(() => null)) as {
        path?: string;
        message?: string;
      } | null;
      if (!res.ok || !data?.path) {
        setNote({
          text: data?.message ?? 'The photo was not uploaded. Try again.',
          field: 'imageUrl',
        });
        return;
      }
      set('imageUrl', data.path);
      setNote({ text: 'Photo uploaded. Save the article to keep it.' });
    } catch {
      setNote({ text: 'The photo was not uploaded. Check your connection.', field: 'imageUrl' });
    } finally {
      setUploading(false);
      // Let the same file be picked again after a removal.
      if (filePicker.current) filePicker.current.value = '';
    }
  }

  // A scheduled article shows its time; one that is already live keeps its original date
  // unless the editor picks a new one.
  useEffect(() => {
    if (article?.state === 'scheduled' && article.publishedAt) {
      setFields((f) => ({ ...f, publishAt: toLocalInputValue(new Date(article.publishedAt!)) }));
    }
  }, [article]);
  useEffect(() => {
    setSavedLabel(savedAt ? `Last saved ${formatDayTime(new Date(savedAt))}` : 'Not saved yet');
  }, [savedAt]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = <K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setNote(null);
  };

  function save(publish: boolean) {
    if (!fields.title.trim()) {
      setNote({ text: 'A headline is required.', field: 'title' });
      return;
    }
    startTransition(async () => {
      const result = await saveArticleAction({
        id,
        publish,
        fields: {
          ...fields,
          publishAt: fields.publishAt ? new Date(fields.publishAt).toISOString() : '',
        },
      });
      if (!result.ok) {
        setNote({ text: result.message, ...(result.field ? { field: result.field } : {}) });
        return;
      }
      if (!id) window.history.replaceState(null, '', `/admin/news/${result.id}`);
      setId(result.id);
      setState(result.state);
      setSavedAt(result.savedAt);
      setDirty(false);
      setNote({
        text:
          result.state === 'published'
            ? 'Published. It is live on the site now.'
            : result.state === 'scheduled'
              ? 'Scheduled. It goes live on its own at the time you set.'
              : state && state !== 'draft'
                ? 'Saved as a draft. It is no longer on the site.'
                : 'Draft saved.',
      });
    });
  }

  const isNew = id === null;
  const words = fields.body.trim() ? fields.body.trim().split(/\s+/).length : 0;
  const paragraphs = fields.body.split(/\n\s*\n/).filter((p) => p.trim());
  const invalid = (field: ArticleField) => (note?.field === field ? true : undefined);
  const showPhoto = fields.imageUrl.trim() !== '' && isPhotoAddress(fields.imageUrl.trim());

  return (
    <section>
      <div className="pt-6">
        <Link href="/admin/news" className="text-[13px] text-ink-2 hover:text-accent">
          ← News
        </Link>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-7 pb-5">
        <div>
          <span className="mb-2.5 block kicker">
            {isNew ? 'New article' : `Editing · ${state ? STATE_LABEL[state] : ''}`}
          </span>
          <h1 className="-ml-[0.04em] text-[clamp(28px,4vw,48px)] leading-[1.02] font-extrabold tracking-[-0.02em]">
            {isNew ? 'Write a story' : 'Edit article'}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {id && state === 'published' && (
            <a href={`/news/${id}`} target="_blank" rel="noopener" className="btn btn-ghost">
              View on site ↗
            </a>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => save(false)}
          >
            {state && state !== 'draft' ? 'Unpublish to draft' : 'Save draft'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => save(true)}
          >
            {busy ? 'Saving…' : state && state !== 'draft' ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>
      <div className="rule-2" />
      <p role="status" className="mt-3 min-h-5 text-[13px] text-accent-700">
        {note?.text ?? ''}
      </p>

      <div className="grid grid-cols-1 gap-x-14 gap-y-10 pt-5 min-[900px]:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="field">
              <label htmlFor="a-league">Competition</label>
              <select
                id="a-league"
                className="input"
                value={fields.leagueSlug}
                onChange={(e) => set('leagueSlug', e.target.value)}
              >
                <option value="">{GENERAL}</option>
                {LEAGUES.map((l) => (
                  <option key={l.slug} value={l.slug}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="a-tag">Tag</label>
              <input
                id="a-tag"
                className="input"
                placeholder="e.g. Match report"
                maxLength={LIMITS.tag}
                value={fields.tag}
                onChange={(e) => set('tag', e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="a-title">Headline</label>
            <input
              id="a-title"
              className="input text-xl font-extrabold"
              placeholder="Write a clear, specific headline"
              maxLength={LIMITS.title}
              aria-invalid={invalid('title')}
              value={fields.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="a-summary">Standfirst</label>
            <textarea
              id="a-summary"
              className="input min-h-[72px] resize-y"
              placeholder="One or two sentences that summarise the story"
              maxLength={LIMITS.summary}
              value={fields.summary}
              onChange={(e) => set('summary', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="a-body">Body</label>
            <textarea
              id="a-body"
              className="input min-h-[280px] resize-y leading-[1.55]"
              placeholder="Article text. Blank line between paragraphs."
              maxLength={LIMITS.body}
              value={fields.body}
              onChange={(e) => set('body', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="field">
              <label htmlFor="a-author">Author</label>
              <input
                id="a-author"
                className="input"
                maxLength={LIMITS.author}
                value={fields.author}
                onChange={(e) => set('author', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="a-caption">Photo caption</label>
              <input
                id="a-caption"
                className="input"
                placeholder="Describe the image"
                maxLength={LIMITS.caption}
                value={fields.caption}
                onChange={(e) => set('caption', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="field">
              <label htmlFor="a-image">Photo (optional)</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={uploading}
                  onClick={() => filePicker.current?.click()}
                >
                  {uploading ? 'Uploading…' : fields.imageUrl ? 'Replace photo' : 'Upload photo'}
                </button>
                {fields.imageUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => set('imageUrl', '')}
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={filePicker}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-label="Choose a photo to upload"
                onChange={(e) => void uploadPhoto(e.target.files?.[0])}
              />
              <input
                id="a-image"
                className="input mt-2"
                inputMode="url"
                placeholder="or paste an https:// address"
                aria-invalid={invalid('imageUrl')}
                value={fields.imageUrl}
                onChange={(e) => set('imageUrl', e.target.value)}
              />
              <span className="mt-1.5 block text-xs text-ink-3">
                JPEG, PNG or WebP, up to 5 MB.
              </span>
            </div>
            <div className="field">
              <label htmlFor="a-when">Publish at (optional)</label>
              <input
                id="a-when"
                className="input"
                type="datetime-local"
                aria-invalid={invalid('publishAt')}
                value={fields.publishAt}
                onChange={(e) => set('publishAt', e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={fields.featured}
                onChange={(e) => set('featured', e.target.checked)}
              />
              Feature on home
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={fields.commentsOn}
                onChange={(e) => set('commentsOn', e.target.checked)}
              />
              Allow comments
            </label>
          </div>
          <div className="flex justify-between gap-4 tnum text-xs text-ink-3">
            <span>
              {words} words · {Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min read
            </span>
            <span>{dirty ? 'Unsaved changes' : savedLabel}</span>
          </div>
        </div>

        <div className="min-w-0">
          <h2 className="pb-2.5 eyebrow">Preview</h2>
          <div className="rule-2" />
          <div className="mt-4 border bg-surface p-7">
            <div className="mb-3 flex flex-wrap gap-3 text-xs tracking-[0.08em] uppercase">
              <span className="font-semibold text-accent-700">
                {sectionLabel(fields.leagueSlug || null, fields.tag.trim())}
              </span>
              <span className="text-ink-3">Just now · {fields.author.trim() || 'Staff'}</span>
            </div>
            <h3
              className={`mb-3.5 -ml-[0.02em] text-[clamp(24px,2.6vw,34px)] leading-[1.08] font-extrabold tracking-[-0.02em] ${
                fields.title ? '' : 'text-neutral-500'
              }`}
            >
              {fields.title || 'Your headline appears here'}
            </h3>
            <p className="mb-5 text-base leading-[1.45] text-[color-mix(in_srgb,var(--color-ink)_80%,transparent)]">
              {fields.summary || 'The standfirst summarises the story in one or two sentences.'}
            </p>
            <div className="rule-2" />
            {showPhoto ? (
              <figure className="my-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fields.imageUrl.trim()}
                  alt=""
                  className="aspect-video w-full bg-neutral-300 object-cover contrast-[1.08] grayscale"
                />
                {fields.caption && (
                  <figcaption className="mt-1 text-[11px] text-ink-3">{fields.caption}</figcaption>
                )}
              </figure>
            ) : (
              <div className="my-4 grid aspect-video place-items-center bg-neutral-300 p-3 text-center text-[11px] tracking-[0.08em] text-neutral-700 uppercase">
                {fields.caption || 'Photo · B&W'}
              </div>
            )}
            {paragraphs.map((p, i) => (
              <p key={i} className="mb-3.5 text-[15px] leading-[1.6] whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
