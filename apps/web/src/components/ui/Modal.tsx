import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Portal, useOverlay } from './overlay';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Buttons row: right-aligned on desktop, two equal columns on phones. */
  footer?: React.ReactNode;
  /** md 520 (forms), lg 640. */
  size?: 'md' | 'lg';
  className?: string;
  bodyClassName?: string;
}

/**
 * Forms and details. From 640px: a centred 520px dialog, radius 28. Below: a full-height sheet
 * with a grab handle, the same content in a different shell (design: "Bir xil kontent, ikki qobiq").
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
  bodyClassName,
}: ModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  useOverlay(panelRef, isOpen, onClose);

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
        <div className="absolute inset-0 animate-ft-fade-in bg-overlay" onClick={onClose} aria-hidden="true" />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          className={cn(
            'relative flex w-full flex-col overflow-hidden bg-popover text-text shadow-lg outline-none',
            // Phone: full-height sheet sliding up, 12px of the page still visible on top.
            'h-[calc(100%-12px)] animate-ft-sheet-in rounded-t-2xl',
            // Tablet and up: centred dialog sized to its content.
            'sm:h-auto sm:max-h-[min(860px,calc(100vh-48px))] sm:animate-ft-dialog-in sm:rounded-2xl',
            size === 'lg' ? 'sm:max-w-[640px]' : 'sm:max-w-[520px]',
            className,
          )}
        >
          <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-input sm:hidden" aria-hidden />
          <div className="flex shrink-0 items-start justify-between gap-4 px-4 pb-3 pt-2 sm:px-6 sm:pb-3 sm:pt-[22px]">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id={titleId} className="text-[20px] font-semibold leading-7 tracking-[-0.01em]">
                {title}
              </h2>
              {description && (
                <div id={descriptionId} className="text-[14px] leading-5 text-text-secondary">
                  {description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-text-secondary transition-colors duration-fast hover:bg-secondary-hover hover:text-text focus-ring"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className={cn('flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-4 pb-5 pt-1 sm:px-6 sm:pb-6', bodyClassName)}>
            {children}
          </div>
          {footer && (
            <div
              className="grid shrink-0 grid-cols-2 gap-2.5 border-t border-border px-4 pt-3 sm:flex sm:justify-end sm:px-6 sm:py-3.5 [&>*]:h-12 sm:[&>*]:h-10"
              style={{ paddingBottom: 'max(16px, calc(12px + env(safe-area-inset-bottom, 0px)))' }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
