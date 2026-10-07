import * as React from 'react';
import { useMediaQuery } from './useMediaQuery';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Exit lengths: 0.75× the enter duration, matching --duration-*-exit in tokens.css. */
export const EXIT_MS = { base: 150, slow: 240 } as const;

/** For code outside React (stores); components use useReducedMotion so they follow changes. */
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}

export interface Presence {
  /** Render the element. */
  mounted: boolean;
  /** Closed, but still on screen for its exit animation. */
  closing: boolean;
}

/**
 * Keeps a closed element mounted for `exitMs` so it can animate out. With reduced motion the
 * exit is instant, the same DOM as without animation.
 */
export function usePresence(open: boolean, exitMs: number): Presence {
  const reduced = useReducedMotion();
  const [leaving, setLeaving] = React.useState(false);
  const [wasOpen, setWasOpen] = React.useState(open);
  // Decided during render, not in an effect: the closing render must not drop the element first.
  if (open !== wasOpen) {
    setWasOpen(open);
    setLeaving(!open && !reduced && exitMs > 0);
  }

  React.useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [leaving, exitMs]);

  return { mounted: open || leaving, closing: !open && leaving };
}

/** Anchored panels (menus, popovers, listboxes): pop in, pop out without catching clicks. */
export function popMotion(closing: boolean): string {
  return closing ? 'pointer-events-none animate-ft-pop-out' : 'animate-ft-pop-in';
}

/**
 * The last props an overlay was opened with. Parents often clear their data as they close
 * (`isOpen={tx !== null}`); the exit animation keeps showing what was there.
 */
export function useOpenSnapshot<T>(open: boolean, value: T): T {
  const ref = React.useRef(value);
  if (open) ref.current = value;
  return ref.current;
}
