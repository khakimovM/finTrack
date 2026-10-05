import * as React from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openCount = 0;
let savedOverflow = '';

/**
 * Shared behaviour of modals and sheets: Escape closes, Tab stays inside, the page behind does
 * not scroll, focus moves in on open and returns to the opener on close.
 */
export function useOverlay(panelRef: React.RefObject<HTMLElement | null>, isOpen: boolean, onClose: () => void) {
  // Callers pass inline onClose functions: depending on them would re-run this effect on every
  // render and pull focus out of the field the user is typing in.
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  // Captured while rendering the opening render: by the time effects run, an autoFocus control
  // inside the panel already holds focus and the real opener would be lost.
  const openerRef = React.useRef<HTMLElement | null>(null);
  const wasOpenRef = React.useRef(false);
  if (isOpen && !wasOpenRef.current && typeof document !== 'undefined') {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasOpenRef.current = isOpen;

  React.useEffect(() => {
    if (!isOpen) return;
    const opener = openerRef.current;
    const panel = panelRef.current;

    // Nested overlays (a confirm over a form) share one lock: saved by the first, restored by the last.
    if (openCount === 0) savedOverflow = document.body.style.overflow;
    openCount += 1;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Only the top-most overlay answers.
        if (panel && !panel.contains(document.activeElement) && document.activeElement !== document.body) return;
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    // An autofocused control inside the panel keeps its focus.
    if (panel && !panel.contains(document.activeElement)) panel.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openCount -= 1;
      if (openCount === 0) document.body.style.overflow = savedOverflow;
      opener?.focus();
    };
  }, [isOpen, panelRef]);
}

export function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
