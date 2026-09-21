import { useTranslations } from 'next-intl';

export type NoticeKind =
  'table' | 'fixtures' | 'scorers' | 'match' | 'team' | 'player' | 'article' | 'unsupported';

/** Shown in place of a section whose data could not be loaded. */
export function DataNotice({ kind }: { kind: NoticeKind }) {
  const t = useTranslations('notice');
  return (
    <p role="status" className="py-12 text-[17px] text-ink-2">
      {t(kind)}
    </p>
  );
}
