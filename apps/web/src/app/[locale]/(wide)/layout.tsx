import type { ReactNode } from 'react';
import { Shell } from '@/components/shell';

/**
 * Pages that use the whole frame rather than the usual 1240px column: an article, with its
 * column of other headlines beside it, reads better with the room.
 */
export default function WideLayout({ children }: { children: ReactNode }) {
  return <Shell wide>{children}</Shell>;
}
