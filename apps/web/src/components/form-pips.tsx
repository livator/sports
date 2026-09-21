import type { FormResult } from '@sports/core';
import { useTranslations } from 'next-intl';

const styles: Record<FormResult, string> = {
  W: 'bg-ink text-ground',
  D: 'bg-transparent text-ink',
  L: 'bg-ground text-neutral-500',
};
const wordKey = { W: 'formWon', D: 'formDrew', L: 'formLost' } as const;
const letterKey = { W: 'won', D: 'drawn', L: 'lost' } as const;

/** Recent results, oldest first. Win is solid, draw is outlined, loss is faded. */
export function FormPips({ form, size = 'sm' }: { form: FormResult[]; size?: 'sm' | 'md' | 'lg' }) {
  const t = useTranslations('table');
  if (form.length === 0) return <span className="text-ink-3">–</span>;
  const box =
    size === 'lg'
      ? 'h-9 w-7 text-xs'
      : size === 'md'
        ? 'size-[22px] text-[10px]'
        : 'size-[18px] text-[9px]';
  return (
    <span
      className={`inline-flex ${size === 'lg' ? 'gap-1' : 'gap-[3px]'}`}
      aria-label={t('formLabel', { results: form.map((r) => t(wordKey[r])).join(', ') })}
    >
      {form.map((result, i) => (
        <span
          key={i}
          aria-hidden
          className={`grid place-items-center border border-ink font-extrabold ${box} ${styles[result]}`}
        >
          {/* The same one-letter codes as the table's W / D / L column heads. */}
          {t(letterKey[result])}
        </span>
      ))}
    </span>
  );
}
