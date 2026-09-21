import Link from 'next/link';
import { NotFoundView } from '@/components/not-found-view';

/** 404 inside the console: an unknown address, or an article that was deleted meanwhile. */
export default function AdminNotFound() {
  return (
    <NotFoundView
      kicker="Error 404"
      title="Offside"
      text="There is nothing at this address in the console. If you followed a link to an article, it may have been deleted."
      actions={
        <>
          <Link href="/admin" className="btn btn-primary">
            Overview
          </Link>
          <Link href="/admin/news" className="btn btn-secondary">
            News
          </Link>
          <Link href="/admin/users" className="btn btn-secondary">
            Users
          </Link>
        </>
      }
    />
  );
}
