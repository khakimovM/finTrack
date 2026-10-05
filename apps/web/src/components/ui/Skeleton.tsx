import * as React from 'react';
import { cn } from '../../lib/utils';

/** Placeholder block shaped like the content it stands for; pulses unless motion is reduced. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('animate-ft-pulse rounded-[8px] bg-secondary', className)} {...props} />;
}
