import * as React from 'react';
import { cn } from '../../lib/utils';
import { EXIT_MS, usePresence } from '../../lib/motion';

export interface CollapseProps {
  open: boolean;
  children: React.ReactNode;
  id?: string;
  /** Leave the closed content in the DOM, `hidden` (an accordion answer its button controls). */
  keepMounted?: boolean;
  className?: string;
}

/**
 * Height that opens and closes smoothly: a one-row grid going 0fr → 1fr needs no measuring,
 * so content that changes height while open just follows.
 */
export function Collapse({ open, children, id, keepMounted = false, className }: CollapseProps) {
  const { mounted, closing } = usePresence(open, EXIT_MS.slow);
  // Mounted collapsed, then expanded a frame later; otherwise there is no 0fr to grow from.
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setExpanded(false);
      return;
    }
    const frame = requestAnimationFrame(() => setExpanded(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!mounted && !keepMounted) return null;

  return (
    <div
      id={id}
      hidden={!mounted}
      // `grid` would beat the hidden attribute's display: none, so the closed state has no classes.
      className={
        mounted
          ? cn(
              'grid transition-[grid-template-rows,opacity] motion-reduce:transition-none',
              open && expanded
                ? 'grid-rows-[1fr] opacity-100 duration-slow ease-standard'
                : 'grid-rows-[0fr] opacity-0 duration-[var(--duration-slow-exit)] ease-in',
              closing && 'pointer-events-none',
              className,
            )
          : undefined
      }
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
