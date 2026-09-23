'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteArticleAction } from '@/app/admin/actions';
import { ConfirmDialog } from '@/components/confirm-dialog';
import type { ArticleState } from '@/lib/articles';
import { AdminTime } from './admin-time';
import { FilterChips } from './filter-chips';
import { STATE_LABEL, STATE_TAG, type ArticleListItem } from './shared';

type Filter = 'all' | ArticleState;
const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'draft', label: 'Drafts' },
];

export function NewsTable({ articles }: { articles: ArticleListItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();

  const needle = query.trim().toLowerCase();
  const rows = articles.filter(
    (a) =>
      (filter === 'all' || a.state === filter) &&
      (!needle ||
        a.title.toLowerCase().includes(needle) ||
        a.author.toLowerCase().includes(needle)),
  );

  // The article waiting for a yes or no, if any.
  const [doomed, setDoomed] = useState<ArticleListItem | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  function confirmDelete() {
    if (!doomed) return;
    setFailed(null);
    startTransition(async () => {
      try {
        const result = await deleteArticleAction(doomed.id);
        if (!result.ok) {
          setFailed('The article was not deleted. Try again.');
          return;
        }
        setDoomed(null);
        router.refresh();
      } catch {
        setFailed('The article was not deleted. Check your connection and try again.');
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b py-3.5">
        <FilterChips label="Status" items={FILTERS} active={filter} onSelect={setFilter} />
        <input
          type="search"
          className="input w-60 max-w-full"
          placeholder="Search articles"
          aria-label="Search articles"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <p className="pt-8 text-[15px] text-ink-2">
          {articles.length === 0 ? 'No articles yet.' : 'No articles match.'}
        </p>
      ) : (
        <div className="overflow-x-auto overflow-y-hidden pt-6">
          <table className="table min-w-[720px]">
            <thead>
              <tr>
                <th scope="col">Article</th>
                <th scope="col">Competition</th>
                <th scope="col">Author</th>
                <th scope="col">Updated</th>
                <th scope="col" className="num">
                  Views
                </th>
                <th scope="col" className="num">
                  Comments
                </th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr
                  key={a.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/news/${a.id}`)}
                >
                  <td className="max-w-[360px] font-semibold">
                    {/* The row click is a convenience; this link is what keyboards and screen readers use. */}
                    <a
                      href={`/admin/news/${a.id}`}
                      className="block truncate hover:text-accent"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {a.title}
                    </a>
                  </td>
                  <td className="text-ink-2">{a.section}</td>
                  <td>{a.author || '–'}</td>
                  <td className="text-ink-3">
                    <AdminTime iso={a.updatedAt} mode="dayTime" />
                  </td>
                  <td className="num">{a.views.toLocaleString('en-GB')}</td>
                  <td className="num">{a.comments}</td>
                  <td>
                    <span className={`tag ${STATE_TAG[a.state]}`}>{STATE_LABEL[a.state]}</span>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="btn btn-ghost text-[13px]"
                      disabled={pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFailed(null);
                        setDoomed(a);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={doomed !== null}
        title="Delete this article?"
        confirmLabel="Delete article"
        busyLabel="Deleting…"
        busy={pending}
        error={failed}
        onConfirm={confirmDelete}
        onCancel={() => setDoomed(null)}
      >
        {doomed && (
          <>
            <p className="font-semibold text-ink">“{doomed.title}”</p>
            <p>
              {doomed.state === 'published'
                ? 'It is live on the site and will disappear from it at once.'
                : doomed.state === 'scheduled'
                  ? 'It is scheduled and will never go live.'
                  : 'It is a draft that readers have not seen.'}{' '}
              {doomed.comments > 0
                ? `Its ${doomed.comments} ${doomed.comments === 1 ? 'comment goes' : 'comments go'} with it, and so does an uploaded photo.`
                : 'An uploaded photo is deleted with it.'}{' '}
              This cannot be undone.
            </p>
          </>
        )}
      </ConfirmDialog>
    </>
  );
}
