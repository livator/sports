import type { Metadata } from 'next';
import { UsersTable } from '@/components/admin/users-table';
import { requireAdmin } from '@/lib/admin';
import { ADMIN_USER_LIMIT, listUsersForAdmin, recentCommentsBy } from '@/lib/admin-data';

export const metadata: Metadata = { title: 'Users' };

type Props = { searchParams: Promise<{ user?: string }> };

export default async function AdminUsersPage({ searchParams }: Props) {
  await requireAdmin();
  const users = await listUsersForAdmin();
  const selectedId = (await searchParams).user;
  const selected = users.find((u) => u.id === selectedId) ?? null;
  const comments = selected ? await recentCommentsBy(selected.id) : [];

  const now = Date.now();
  const activeToday = users.filter(
    (u) => u.lastActiveAt && now - new Date(u.lastActiveAt).getTime() < 86_400_000,
  ).length;

  return (
    <section>
      <div className="pt-10 pb-5">
        <span className="mb-2.5 block kicker">
          {users.length} registered · {activeToday} active today
          {users.length === ADMIN_USER_LIMIT ? ` · showing the newest ${ADMIN_USER_LIMIT}` : ''}
        </span>
        <h1 className="-ml-[0.04em] text-[clamp(36px,5vw,64px)] leading-[1.02] font-extrabold tracking-[-0.02em]">
          Users
        </h1>
      </div>
      <div className="rule-2" />
      <UsersTable users={users} selected={selected} selectedComments={comments} now={now} />
    </section>
  );
}
