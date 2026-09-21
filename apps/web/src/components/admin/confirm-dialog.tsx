'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Asks before something that cannot be undone. A native <dialog> opened with showModal(), so
 * the browser does the hard parts: the rest of the page is inert, Tab stays inside, Escape
 * closes, and focus goes back to the button that opened it.
 *
 * Focus starts on Cancel, so a stray Enter never confirms. While the action runs, the dialog
 * stays open and cannot be dismissed, and a failure is shown inside it.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busyLabel,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  /** What exactly will happen, in a sentence or two. */
  children: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={textId}
      // Escape: the browser asks first. Not while the action is running.
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      // A click on the dimmed area lands on the <dialog> itself, not on its contents.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      className="m-auto w-[min(460px,calc(100%-32px))] bg-surface p-0 text-ink shadow-dialog backdrop:bg-[color-mix(in_srgb,var(--color-neutral-900)_50%,transparent)]"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="text-xl leading-tight font-extrabold tracking-[-0.01em]">
          {title}
        </h2>
        <div id={textId} className="flex flex-col gap-2 text-sm leading-normal text-ink-2">
          {children}
        </div>
        {error && (
          <p role="alert" className="text-[13px] text-accent-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2.5 pt-1">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={busy}
            autoFocus
          >
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
