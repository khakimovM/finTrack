import * as React from 'react';
import { cn } from '../../lib/utils';
import { Skeleton } from './Skeleton';

export interface KpiCardProps {
  label: string;
  /** The number, usually an <Amount unit="muted" />. */
  value: React.ReactNode;
  /** A <ChangeChip /> and what it compares with ("o‘tgan oyga nisbatan"). */
  change?: React.ReactNode;
  vsText?: string;
  /** Line under the value ("Barcha hisoblar jami"). */
  sub?: React.ReactNode;
  subClassName?: string;
  loading?: boolean;
  className?: string;
}

/** Label 14, value 25 (desktop) / 24 (tablet) / 17 (phone), then the change chip. */
export function KpiCard({ label, value, change, vsText, sub, subClassName, loading, className }: KpiCardProps) {
  if (loading) {
    return (
      <div className={cn('flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4 sm:px-6 sm:py-5', className)}>
        <Skeleton className="h-3.5 w-[55%] rounded-[6px]" />
        <Skeleton className="h-[30px] w-[80%]" />
        <Skeleton className="h-[22px] w-1/2 rounded-full" />
      </div>
    );
  }
  return (
    // Fades in as the figures take the skeleton's place.
    <div className={cn('flex min-w-0 animate-ft-fade-in flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:px-6 sm:py-5', className)}>
      <span className="text-[14px] leading-5 text-text-secondary">{label}</span>
      <div className="truncate text-[17px] font-semibold leading-[1.2] tracking-[-0.02em] sm:text-[24px] xl:text-[25px]">
        {value}
      </div>
      {(change || vsText) && (
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          {change}
          {vsText && <span className="text-[12px] leading-4 text-text-muted">{vsText}</span>}
        </div>
      )}
      {sub && <div className={cn('text-[13px] leading-[18px] text-text-muted', subClassName)}>{sub}</div>}
    </div>
  );
}
