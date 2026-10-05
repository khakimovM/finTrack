import * as React from 'react';
import { ArrowDown, ArrowUp, Star, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatPercent } from '../../lib/format';

export type ChipTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'debt';

const TONE: Record<ChipTone, string> = {
  neutral: 'bg-secondary text-text-secondary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  debt: 'bg-debt-soft text-debt',
};

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
  /** 6px dot before the label (status chips). */
  dot?: boolean;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

/** Status pill: 22–24px, soft background in the tone colour. */
export function Chip({ tone = 'neutral', dot, size = 'md', icon, className, children, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full font-medium',
        size === 'sm' ? 'h-[22px] px-2 text-[12px]' : 'h-6 px-[9px] text-[12px]',
        TONE[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {icon}
      {children}
    </span>
  );
}

export interface ChangeChipProps {
  /** Percent change vs the previous period; null when the previous value was 0. */
  value: number | null;
  /** True for income/net/balance (up is good), false for expense (down is good). */
  upIsGood: boolean;
  className?: string;
}

/** "↑ 8,4%" green or red by whether the move is good for the user, "yangi", "o‘zgarmadi". */
export function ChangeChip({ value, upIsGood, className }: ChangeChipProps) {
  if (value === null) {
    return (
      <Chip tone="info" size="sm" className={cn('font-semibold', className)}>
        yangi
      </Chip>
    );
  }
  if (Math.abs(value) < 0.05) {
    return (
      <Chip tone="neutral" size="sm" className={cn('font-semibold', className)}>
        o‘zgarmadi
      </Chip>
    );
  }
  const up = value > 0;
  const good = up === upIsGood;
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <Chip
      tone={good ? 'success' : 'danger'}
      size="sm"
      className={cn('font-semibold', className)}
      aria-label={`${up ? 'O‘sish' : 'Kamayish'} ${formatPercent(Math.abs(value))}`}
    >
      <Arrow className="h-3 w-3" strokeWidth={2.6} aria-hidden />
      {formatPercent(Math.abs(value))}
    </Chip>
  );
}

/** "#oila" on a transaction row: 22px, radius 7, not a pill. */
export function TagChip({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center rounded-[7px] bg-secondary px-2 text-[12px] font-medium text-text-secondary',
        className,
      )}
    >
      #{name}
    </span>
  );
}

/** Active filter with a remove button: muted key, then the value. */
export function FilterChip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-secondary pl-3 pr-1 text-[13px]">
      <span className="text-text-muted">{label}:</span>
      <span className="max-w-[180px] truncate font-medium text-text">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${label} filtrini olib tashlash`}
        className="flex h-6 w-6 items-center justify-center rounded-full text-text-secondary hover:bg-secondary-hover focus-ring"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </span>
  );
}

/** "★ Asosiy" on the default account. */
export function DefaultChip({ className }: { className?: string }) {
  return (
    <Chip tone="warning" size="sm" className={cn('font-semibold', className)}>
      <Star className="h-[11px] w-[11px] fill-current" aria-hidden />
      Asosiy
    </Chip>
  );
}

/** "Standart" on built-in categories: 20px, radius 6. */
export function SystemChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-[6px] bg-secondary px-1.5 text-[11.5px] font-medium text-text-secondary',
        className,
      )}
    >
      Standart
    </span>
  );
}

/** Red count on the bell and the nav item; above 9 it reads "9+". */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold leading-none text-danger-foreground',
        className,
      )}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}
