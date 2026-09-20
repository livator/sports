import { notFound } from 'next/navigation';

/** Any unknown path under a locale renders the translated 404 page. */
export default function CatchAll() {
  notFound();
}
