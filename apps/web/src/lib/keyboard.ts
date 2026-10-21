import * as React from 'react';
import { prefersReducedMotion } from './motion';

/*
 * The on-screen keyboard. A phone raises it for a focused text field and keeps it up until focus
 * leaves the field, and in iOS web views (Telegram, Safari) tapping a button does not take focus
 * away. Without help the keyboard stays over whatever the user opens next, a picker's list
 * included. These helpers close it when the user moves on and keep what opened in view.
 */

const TEXT_ENTRY = [
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="range"]):not([type="color"]):not([type="file"])',
  'textarea',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(', ');

/** Taps on these keep the keyboard: they focus a field themselves or open a native picker. */
const KEEPS_KEYBOARD = `${TEXT_ENTRY}, label, select`;

/** Taps on these act once the tap is over; anything else is background. */
const INTERACTIVE = 'button, a[href], [role="button"], [role="option"], [role="tab"], [role="radio"], [role="menuitem"], summary';

export const TOUCH_QUERY = '(pointer: coarse)';

export function isTextEntry(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && element.matches(TEXT_ENTRY);
}

/** A finger is the main pointer: focusing a field opens the on-screen keyboard. */
export function isTouchScreen(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(TOUCH_QUERY).matches;
}

/** Takes focus off the text field that holds the keyboard, which closes it. */
export function dismissKeyboard(): void {
  const active = document.activeElement;
  if (isTextEntry(active)) active.blur();
}

/** Scrolls something that just opened (a picker's list) fully into view inside its scroller. */
export function reveal(element: Element | null | undefined, block: ScrollLogicalPosition = 'nearest'): void {
  element?.scrollIntoView?.({ block, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/**
 * Once the keyboard has opened for a field, scrolls `element` to the top of its scroller so the
 * keyboard does not cover it (a picker's search box and the list under it). The viewport resizes
 * in steps while the keyboard slides in, so this waits for the last step.
 */
export function revealAboveKeyboard(element: HTMLElement | null): void {
  if (!element || !isTouchScreen()) return;
  const viewport = window.visualViewport;
  let timer = 0;
  const finish = () => {
    viewport?.removeEventListener('resize', settle);
    window.removeEventListener('resize', settle);
    reveal(element, 'start');
  };
  const settle = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(finish, 120);
  };
  viewport?.addEventListener('resize', settle);
  window.addEventListener('resize', settle);
  // The keyboard was already up, or this browser does not resize for it.
  timer = window.setTimeout(finish, 450);
}

/**
 * Inside an overlay on a touch screen: a tap outside text fields closes the keyboard, as native
 * forms do. Background taps close it at once; taps on buttons and options close it after the
 * click, so nothing moves under the finger before the tap lands.
 */
export function useDismissKeyboardOnTap(panelRef: React.RefObject<HTMLElement | null>, active: boolean): void {
  React.useEffect(() => {
    const panel = panelRef.current;
    if (!active || !panel) return;
    const keeps = (target: EventTarget | null) => !(target instanceof Element) || target.closest(KEEPS_KEYBOARD) !== null;
    const onPointerDown = (event: PointerEvent) => {
      if (!isTouchScreen() || keeps(event.target)) return;
      if ((event.target as Element).closest(INTERACTIVE) === null) dismissKeyboard();
    };
    const onClick = (event: MouseEvent) => {
      if (isTouchScreen() && !keeps(event.target)) dismissKeyboard();
    };
    panel.addEventListener('pointerdown', onPointerDown);
    panel.addEventListener('click', onClick, true);
    return () => {
      panel.removeEventListener('pointerdown', onPointerDown);
      panel.removeEventListener('click', onClick, true);
    };
  }, [panelRef, active]);
}

/**
 * Where an overlay should sit while the keyboard is up. iOS Safari and Android Chrome lay the
 * keyboard over the page instead of shrinking it, so a full-screen overlay would keep its footer
 * and the field in use under the keyboard; this returns a frame over the visible part instead.
 * Telegram resizes its web view for the keyboard: there both heights match and nothing changes.
 */
export function useKeyboardFrame(active: boolean): React.CSSProperties | undefined {
  const [frame, setFrame] = React.useState<{ top: number; height: number } | null>(null);

  React.useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) return;
    const update = () => {
      const covered = window.innerHeight - viewport.height;
      // Pinch zoom shrinks the visual viewport too; at scale 1 only the keyboard does.
      const next = covered > 1 && Math.abs(viewport.scale - 1) < 0.01 ? { top: viewport.offsetTop, height: viewport.height } : null;
      setFrame((prev) => (prev?.top === next?.top && prev?.height === next?.height ? prev : next));
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      setFrame(null);
    };
  }, [active]);

  return frame ? { top: frame.top, height: frame.height, bottom: 'auto' } : undefined;
}
