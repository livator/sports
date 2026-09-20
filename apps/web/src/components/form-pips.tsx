import type { FormResult } from '@sports/core';
import { cn } from '@/lib/utils';

const styles: Record<FormResult, string> = {
  W: 'bg-win/90 text-black',
  D: 'bg-draw/40 text-ink',
  L: 'bg-loss/90 text-white',
};

export function FormPips({ form, className }: { form: FormResult[]; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      aria-label={`Form: ${form.join(' ')}`}
    >
      {form.map((r, i) => (
        <span
          key={i}
          className={cn(
            'inline-flex size-5 items-center justify-center rounded-md text-[10px] font-bold',
            styles[r],
            i === form.length - 1 && 'ring-2 ring-white/20',
          )}
        >
          {r}
        </span>
      ))}
    </span>
  );
}
