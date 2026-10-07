import * as React from 'react';
import { cn } from '../../lib/utils';
import { useInView, useReducedMotion } from '../../lib/motion';

/** static: reduced motion, drawn as is; waiting: not scrolled to yet, invisible; playing: arriving. */
export type RevealState = 'static' | 'waiting' | 'playing';

export interface Beat {
  className: string;
  style?: React.CSSProperties;
}

export function useReveal<T extends Element>(): [React.RefCallback<T>, RevealState] {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<T>();
  return [ref, reduced ? 'static' : inView ? 'playing' : 'waiting'];
}

/** Classes and delay for one element of a revealed group; `base` is merged in front. */
export function beat(state: RevealState, delayMs: number, base?: string, animation = 'animate-ft-rise'): Beat {
  if (state === 'static') return { className: cn(base) };
  if (state === 'waiting') return { className: cn(base, 'opacity-0') };
  return { className: cn(base, animation), style: delayMs ? { animationDelay: `${delayMs}ms` } : undefined };
}

/** The same for things that play on page load (the hero): no observer, only reduced motion. */
export function useEntrance(): (delayMs: number, base?: string, animation?: string) => Beat {
  const reduced = useReducedMotion();
  return (delayMs, base, animation) => beat(reduced ? 'static' : 'playing', delayMs, base, animation);
}

type RevealTag = 'div' | 'article' | 'li';

export interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  as?: RevealTag;
  delay?: number;
  animation?: string;
}

/** Rises into place the first time it scrolls into view. */
export function Reveal({ as: Tag = 'div', delay = 0, animation, className, style, children, ...rest }: RevealProps) {
  const [ref, state] = useReveal<HTMLElement>();
  const motion = beat(state, delay, className, animation);
  return (
    <Tag ref={ref} className={motion.className} style={{ ...style, ...motion.style }} {...rest}>
      {children}
    </Tag>
  );
}
