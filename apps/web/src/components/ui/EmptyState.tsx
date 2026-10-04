import * as React from 'react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** page: centred block in a list; widget: dashed box inside a card. */
  variant?: 'page' | 'widget';
  className?: string;
}

/** Nothing to show yet: icon tile, one line of why, and the action that fixes it. */
export function EmptyState({ icon, title, description, action, variant = 'page', className }: EmptyStateProps) {
  if (variant === 'widget') {
    return (
      <div
        className={cn(
          'flex min-h-[200px] flex-col items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-border px-4 py-8 text-center',
          className,
        )}
      >
        <p className="text-[15px] font-medium text-text-secondary">{title}</p>
        {description && <p className="max-w-[300px] text-[13px] leading-[18px] text-text-muted">{description}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2.5 px-4 py-14 text-center', className)}>
      {icon && (
        <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-lg bg-secondary text-text-secondary [&_svg]:h-6 [&_svg]:w-6 [&_svg]:stroke-[1.8]">
          {icon}
        </div>
      )}
      <h3 className="text-[16px] font-semibold leading-6 text-text">{title}</h3>
      {description && <p className="max-w-[340px] text-[14px] leading-5 text-text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
