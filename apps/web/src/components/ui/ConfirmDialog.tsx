import { type ReactNode, useCallback, useId, useRef, useState } from 'react';
import { Info, Trash2, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { Portal, useOverlay } from './overlay';

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button and tile, for deletions and other hard-to-undo actions. */
  destructive?: boolean;
  /** Icon in the round tile; defaults to a bin (destructive) or an info mark. */
  icon?: LucideIcon;
  /** false: a single acknowledgement button ("Tushunarli"). */
  hasCancel?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

function ConfirmPanel({ pending, answer }: { pending: PendingConfirm; answer: (confirmed: boolean) => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useOverlay(panelRef, true, () => answer(false));
  const destructive = pending.destructive ?? false;
  const Icon = pending.icon ?? (destructive ? Trash2 : Info);
  const hasCancel = pending.hasCancel ?? true;

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
        <div className="absolute inset-0 animate-ft-fade-in bg-overlay" onClick={() => answer(false)} aria-hidden="true" />
        <div
          ref={panelRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={pending.description ? descriptionId : undefined}
          tabIndex={-1}
          className="relative flex w-full flex-col gap-2 rounded-t-2xl bg-popover p-6 text-text shadow-lg outline-none animate-ft-sheet-in sm:max-w-[440px] sm:animate-ft-dialog-in sm:rounded-[24px]"
          style={{ paddingBottom: 'max(24px, calc(16px + env(safe-area-inset-bottom, 0px)))' }}
        >
          <div
            className={cn(
              'mb-2 flex h-11 w-11 items-center justify-center rounded-full',
              destructive ? 'bg-danger-soft text-danger' : 'bg-secondary text-text',
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <h2 id={titleId} className="text-[18px] font-semibold leading-[26px]">
            {pending.title}
          </h2>
          {pending.description && (
            <div id={descriptionId} className="text-[14px] leading-5 text-text-secondary">
              {pending.description}
            </div>
          )}
          <div className={cn('mt-3.5 grid gap-2.5 sm:flex sm:justify-end', hasCancel ? 'grid-cols-2' : 'grid-cols-1')}>
            {hasCancel && (
              <Button variant="secondary" onClick={() => answer(false)} className="h-12 sm:h-10">
                {pending.cancelLabel ?? 'Bekor qilish'}
              </Button>
            )}
            <Button
              variant={destructive ? 'destructive' : 'primary'}
              onClick={() => answer(true)}
              className="h-12 sm:h-10"
              autoFocus
            >
              {pending.confirmLabel ?? 'Tasdiqlash'}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/**
 * In-app replacement for window.confirm (which blocks the page and looks foreign inside the
 * Telegram Mini App). Render the returned element once; `confirm()` resolves on the answer.
 */
export function useConfirm(): [ReactNode, (options: ConfirmOptions) => Promise<boolean>] {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const answer = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  const dialog = pending ? <ConfirmPanel pending={pending} answer={answer} /> : null;
  return [dialog, confirm];
}
