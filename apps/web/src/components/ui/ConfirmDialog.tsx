import { ReactNode, useCallback, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  /** Red confirm button for deletions and other hard-to-undo actions. */
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/**
 * In-app replacement for window.confirm (which blocks the page and looks foreign inside the
 * Telegram Mini App). Render the returned element once; `confirm()` resolves on the answer.
 */
export function useConfirm(): [ReactNode, (options: ConfirmOptions) => Promise<boolean>] {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const answer = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  const dialog = pending ? (
    <Modal
      isOpen
      onClose={() => answer(false)}
      title={pending.title}
      description={pending.description}
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => answer(false)}>
          Bekor qilish
        </Button>
        <Button
          variant={pending.destructive ? 'destructive' : 'default'}
          onClick={() => answer(true)}
          autoFocus
        >
          {pending.confirmLabel ?? 'Tasdiqlash'}
        </Button>
      </div>
    </Modal>
  ) : null;

  return [dialog, confirm];
}
