import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Portal, useOverlay } from './overlay';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Visible title; an aria-label is used when the sheet has none. */
  title?: string;
  'aria-label'?: string;
  /** Header content right of the title (an unread pill). */
  headerExtra?: React.ReactNode;
  /** Full height (notifications, filters) instead of fitting the content (menus, quick add). */
  full?: boolean;
  /** A close button next to the title (full sheets have one). */
  showClose?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Phone bottom sheet: handle, optional title, content; respects the home-indicator area. */
export function Sheet({
  isOpen,
  onClose,
  title,
  'aria-label': ariaLabel,
  headerExtra,
  full = false,
  showClose = full,
  footer,
  children,
  className,
  bodyClassName,
}: SheetProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useOverlay(panelRef, isOpen, onClose);

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 animate-ft-fade-in bg-overlay" onClick={onClose} aria-hidden="true" />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-label={title ? undefined : ariaLabel}
          tabIndex={-1}
          className={cn(
            'absolute inset-x-0 bottom-0 z-[51] flex max-h-[calc(100%-12px)] flex-col animate-ft-sheet-in rounded-t-2xl bg-popover text-text shadow-lg outline-none',
            full && 'top-3',
            className,
          )}
        >
          <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-input" aria-hidden />
          {(title || showClose) && (
            <div className="flex shrink-0 items-center gap-2.5 px-4 pb-2 pt-3">
              {title && (
                <h2 id={titleId} className="text-[20px] font-semibold leading-7">
                  {title}
                </h2>
              )}
              {headerExtra}
              {showClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Yopish"
                  className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-text-secondary hover:bg-secondary focus-ring"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              )}
            </div>
          )}
          <div
            className={cn('min-h-0 flex-1 overflow-y-auto px-4', bodyClassName)}
            style={footer ? undefined : { paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
          >
            {children}
          </div>
          {footer && (
            <div
              className="grid shrink-0 grid-cols-2 gap-2.5 border-t border-border px-4 pt-3 [&>*]:h-12"
              style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
