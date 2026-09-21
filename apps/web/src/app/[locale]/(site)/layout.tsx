import type { ReactNode } from 'react';
import { Shell } from '@/components/shell';

/** Every page except the scoreboard: the page frame without a sidebar. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
