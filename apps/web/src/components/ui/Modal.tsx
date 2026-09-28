import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Centered dialog on larger screens, bottom sheet on phones (docs/05 "Mobil"). Focus moves into
 * the dialog when it opens and returns to the element that opened it when it closes.
 */
export function Modal({ isOpen, onClose, title, description, children, className }: ModalProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  // Callers pass inline onClose functions: depending on them would re-run the focus logic on
  // every render and pull focus out of the field the user is typing in.
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  // Captured while rendering the opening: by the time effects run, an autoFocus control inside
  // the dialog already holds focus and the real opener would be lost.
  const openerRef = React.useRef<HTMLElement | null>(null);
  const wasOpenRef = React.useRef(false);
  if (isOpen && !wasOpenRef.current) {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasOpenRef.current = isOpen;

  React.useEffect(() => {
    if (!isOpen) return;
    const opener = openerRef.current;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    // An autofocused control inside the dialog keeps its focus.
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      opener?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto sm:items-center sm:p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-surface p-6 shadow-2xl outline-none sm:my-8 sm:rounded-3xl',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 pb-4">
          <div className="space-y-1">
            <h2 id={titleId} className="text-xl font-bold tracking-tight text-foreground">
              {title}
            </h2>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-11 w-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
            aria-label="Yopish"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="pt-2">{children}</div>
      </div>
    </div>
  );
}
