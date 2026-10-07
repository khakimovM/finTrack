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
 * True once the element has scrolled into view (and stays true). Without IntersectionObserver
 * it answers true at once, so content never waits for an event that will not come.
 */
export function useInView<T extends Element>(rootMargin = '0px 0px -12% 0px'): [React.RefCallback<T>, boolean] {
  const [node, setNode] = React.useState<T | null>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    if (!node || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setInView(true);
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, inView, rootMargin]);

  return [setNode, inView];
}

/**
 * A number counting up to `target` over `durationMs` (ease-out), starting after `delayMs`.
 * The last frame is exactly `target`; reduced motion shows `target` from the start.
 */
export function useCountUp(target: number, { durationMs = 900, delayMs = 0 } = {}): number {
  const reduced = useReducedMotion();
  const [value, setValue] = React.useState(reduced ? target : 0);
  // Where the next count starts: a new target continues from what is on screen.
  const shownRef = React.useRef(value);

  React.useEffect(() => {
    if (reduced) {
      shownRef.current = target;
      setValue(target);
      return;
    }
    const from = shownRef.current;
    if (from === target) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / durationMs);
      const next = t === 1 ? target : from + (target - from) * (1 - (1 - t) ** 3);
      shownRef.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, durationMs, delayMs, reduced]);

  return value;
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
