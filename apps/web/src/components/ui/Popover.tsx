import * as React from 'react';
import { cn } from '../../lib/utils';

/** Closes on a pointer press outside every given element, or on Escape. */
export function useDismiss(
  refs: ReadonlyArray<React.RefObject<HTMLElement | null>>,
  open: boolean,
  onClose: () => void,
): void {
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const refsRef = React.useRef(refs);
  refsRef.current = refs;

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && refsRef.current.some((ref) => ref.current?.contains(target))) return;
      onCloseRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
}

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The element that opens it; the panel is positioned under it. */
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
  panelClassName?: string;
  /** Accessible name of the panel (role="dialog"). */
  label?: string;
}

/** A panel anchored under its trigger: popover background, shadow-md, rounded 20. */
export function Popover({ open, onClose, trigger, children, align = 'start', className, panelClassName, label }: PopoverProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  useDismiss([rootRef], open, onClose);

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      {trigger}
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            'absolute top-full z-40 mt-2 animate-ft-pop-in rounded-xl border border-border bg-popover text-text shadow-md',
            align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
