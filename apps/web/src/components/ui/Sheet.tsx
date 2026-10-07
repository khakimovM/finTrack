import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { EXIT_MS, useOpenSnapshot, usePresence } from '../../lib/motion';
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
  /** Footer buttons share the width equally unless this changes the columns. */
  footerClassName?: string;
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
  footerClassName,
  children,
  className,
  bodyClassName,
}: SheetProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useOverlay(panelRef, isOpen, onClose);
  const { mounted, closing } = usePresence(isOpen, EXIT_MS.slow);
  const view = useOpenSnapshot(isOpen, { title, headerExtra, children, footer });

  if (!mounted) return null;

  return (
    <Portal>
      <div className={cn('fixed inset-0 z-50', closing && 'pointer-events-none')} aria-hidden={closing || undefined}>
        <div
          className={cn('absolute inset-0 bg-overlay', closing ? 'animate-ft-fade-out' : 'animate-ft-fade-in')}
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={view.title ? titleId : undefined}
          aria-label={view.title ? undefined : ariaLabel}
          tabIndex={-1}
          className={cn(
            'absolute inset-x-0 bottom-0 z-[51] flex max-h-[calc(100%-12px)] flex-col rounded-t-2xl bg-popover text-text shadow-lg outline-none',
            closing ? 'animate-ft-sheet-out' : 'animate-ft-sheet-in',
            full && 'top-3',
            className,
          )}
        >
          <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-input" aria-hidden />
          {(view.title || showClose) && (
            <div className="flex shrink-0 items-center gap-2.5 px-4 pb-2 pt-3">
              {view.title && (
                <h2 id={titleId} className="text-[20px] font-semibold leading-7">
                  {view.title}
                </h2>
              )}
              {view.headerExtra}
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
            style={view.footer ? undefined : { paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
          >
            {view.children}
          </div>
          {view.footer && (
            <div
              className={cn('grid shrink-0 grid-cols-2 gap-2.5 border-t border-border px-4 pt-3 [&>*]:h-12', footerClassName)}
              style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
            >
              {view.footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
