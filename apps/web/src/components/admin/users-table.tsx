'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setSuspendedAction } from '@/app/admin/actions';
import type { AdminUser, AdminUserComment } from '@/lib/admin-data';
import { initialsOf } from '@/lib/admin-format';
import { AdminTime } from './admin-time';
import { FilterChips } from './filter-chips';

type Filter = 'all' | 'active' | 'new' | 'suspended';
const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active today' },
  { id: 'new', label: 'Joined this month' },
  { id: 'suspended', label: 'Suspended' },
];
const DAY_MS = 86_400_000;

function status(user: AdminUser, now: number) {
  if (user.suspended) return { label: 'Suspended', tag: 'tag-accent' };
  if (!user.verified) return { label: 'Unverified', tag: 'tag-neutral' };
  const active = user.lastActiveAt && now - new Date(user.lastActiveAt).getTime() < DAY_MS;
  return active ? { label: 'Active', tag: 'tag-outline' } : { label: 'Idle', tag: 'tag-neutral' };
}

export function UsersTable({
  users,
  selected,
  selectedComments,
  now,
}: {
  users: AdminUser[];
  selected: AdminUser | null;
  selectedComments: AdminUserComment[];
  /** Server time of this render, so "active" means the same in the list and the count above. */
  now: number;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const needle = query.trim().toLowerCase();
  const rows = users.filter((u) => {
    const recent = (iso: string | null, span: number) =>
      iso !== null && now - new Date(iso).getTime() < span;
    const inFilter =
      filter === 'all' ||
      (filter === 'active' && recent(u.lastActiveAt, DAY_MS)) ||
      (filter === 'new' && recent(u.joinedAt, 30 * DAY_MS)) ||
      (filter === 'suspended' && u.suspended);
    return (
      inFilter &&
      (!needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle))
    );
  });

  const open = (id: string | null) => {
    setProblem(null);
    router.push(id ? `/admin/users?user=${encodeURIComponent(id)}` : '/admin/users', {
      scroll: false,
    });
  };

  function toggleSuspended(user: AdminUser) {
    if (
      !user.suspended &&
      !window.confirm(`Suspend ${user.name}? They are signed out everywhere and cannot log in.`)
    ) {
      return;
    }
    startTransition(async () => {
      const result = await setSuspendedAction(user.id, !user.suspended);
      if (!result.ok) setProblem(result.message);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b py-3.5">
        <FilterChips label="Users" items={FILTERS} active={filter} onSelect={setFilter} />
        <input
          type="search"
          className="input w-[260px] max-w-full"
          placeholder="Search name or email"
          aria-label="Search name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-x-14 gap-y-10 pt-6">
        <div className="min-w-0 flex-[1_1_560px] overflow-x-auto overflow-y-hidden">
          {rows.length === 0 ? (
            <p className="pt-2 text-[15px] text-ink-2">No users match.</p>
          ) : (
            <table className="table min-w-[680px]">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Email</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Last active</th>
                  <th scope="col" className="num">
                    Comments
                  </th>
                  <th scope="col" className="num">
                    Upvotes
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const s = status(u, now);
                  return (
                    <tr
                      key={u.id}
                      onClick={() => open(u.id)}
                      className={`cursor-pointer ${u.id === selected?.id ? 'bg-accent/8' : ''}`}
                    >
                      <td className="font-semibold">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2.5 text-left hover:text-accent"
                          aria-pressed={u.id === selected?.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            open(u.id);
                          }}
                        >
                          <span className="grid size-6 flex-none place-items-center bg-ink text-[9px] font-extrabold text-ground">
                            {initialsOf(u.name)}
                          </span>
                          {u.name}
                          {u.role === 'admin' && <span className="tag tag-neutral">Admin</span>}
                        </button>
                      </td>
                      <td className="max-w-[200px] truncate text-ink-2" title={u.email}>
                        {u.email}
                      </td>
                      <td className="text-ink-3">
                        <AdminTime iso={u.joinedAt} />
                      </td>
                      <td className="text-ink-3">
                        {u.lastActiveAt ? <AdminTime iso={u.lastActiveAt} mode="ago" /> : '–'}
                      </td>
                      <td className="num">{u.comments}</td>
                      <td className="num">{u.upvotesReceived}</td>
                      <td>
                        <span className={`tag ${s.tag}`}>{s.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <aside className="max-w-[380px] min-w-0 flex-[1_1_300px]" aria-label={selected.name}>
            <div className="flex items-center gap-3.5 pb-4">
              <span className="grid size-12 flex-none place-items-center bg-ink text-[15px] font-extrabold text-ground">
                {initialsOf(selected.name)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[22px] font-extrabold tracking-[-0.02em]">
                  {selected.name}
                </div>
                <div className="truncate text-[13px] text-ink-2">{selected.email}</div>
              </div>
            </div>
            <div className="rule-2" />
            {(
              [
                ['Role', selected.role === 'admin' ? 'Admin' : 'Member'],
                ['Email', selected.verified ? 'Verified' : 'Not verified'],
                ['Joined', <AdminTime key="j" iso={selected.joinedAt} mode="dayTime" />],
                [
                  'Last active',
                  selected.lastActiveAt ? (
                    <AdminTime key="l" iso={selected.lastActiveAt} mode="dayTime" />
                  ) : (
                    'No open session'
                  ),
                ],
                ['Comments', selected.comments],
                ['Upvotes received', selected.upvotesReceived],
                ['Status', status(selected, now).label],
              ] as const
            ).map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b py-2.5 text-sm"
              >
                <span className="text-ink-2">{k}</span>
                <span className="text-right font-semibold">{v}</span>
              </div>
            ))}

            <h2 className="pt-7 pb-2.5 eyebrow">Recent comments</h2>
            <div className="rule-2" />
            {selectedComments.length === 0 && (
              <p className="py-3 text-sm text-ink-2">No comments yet.</p>
            )}
            {selectedComments.map((c) => (
              <div key={c.id} className="border-b py-3 text-sm">
                <div className="mb-1 text-xs text-ink-3">
                  <a href={c.href} target="_blank" rel="noopener" className="hover:text-accent">
                    {c.where} ↗
                  </a>{' '}
                  · <AdminTime iso={c.createdAt} mode="dayTime" />
                </div>
                <p className="leading-[1.45] break-words whitespace-pre-line">{c.body}</p>
              </div>
            ))}

            {problem && (
              <p role="alert" className="pt-4 text-[13px] text-accent-700">
                {problem}
              </p>
            )}
            <div className="flex flex-wrap gap-2.5 pt-5">
              {selected.role !== 'admin' && (
                <button
                  type="button"
                  className={`btn ${selected.suspended ? 'btn-secondary' : 'btn-primary'}`}
                  disabled={pending}
                  onClick={() => toggleSuspended(selected)}
                >
                  {selected.suspended ? 'Lift suspension' : 'Suspend user'}
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => open(null)}>
                Close
              </button>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
