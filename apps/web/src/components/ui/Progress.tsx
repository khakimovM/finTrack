import { cn } from '../../lib/utils';

export type ProgressTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'debt' | 'brand';

/** Budget zones: under 80% fine, 80–100% warning, above 100% over the limit. */
export function budgetTone(percent: number): 'success' | 'warning' | 'danger' {
  if (percent > 100) return 'danger';
  if (percent >= 80) return 'warning';
  return 'success';
}

const FILL: Record<ProgressTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-text-muted',
  info: 'bg-info',
  debt: 'bg-debt',
  brand: 'bg-brand',
};

export interface ProgressProps {
  /** 0–100+; the bar caps at 100%. */
  value: number;
  tone?: ProgressTone;
  /** thin 6 (widgets), md 8 (cards), lg 10 (summaries). */
  size?: 'thin' | 'md' | 'lg';
  /** Fill colour from a CSS colour instead of a tone (category colour). */
  color?: string;
  /** A tick on the track, e.g. the 70% line of the expense ratio. */
  marker?: number;
  className?: string;
  'aria-label'?: string;
}

export function Progress({ value, tone = 'brand', size = 'md', color, marker, className, ...aria }: ProgressProps) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      aria-label={aria['aria-label']}
      className={cn(
        'relative w-full rounded-full bg-secondary',
        size === 'thin' ? 'h-1.5' : size === 'md' ? 'h-2' : 'h-2.5',
        className,
      )}
    >
      <div className="h-full overflow-hidden rounded-full">
        <div
          // Fills from the left when it first shows; later changes slide the width.
          className={cn('h-full origin-left animate-ft-fill rounded-full transition-[width] duration-slow ease-standard', !color && FILL[tone])}
          style={{ width: `${width}%`, background: color }}
        />
      </div>
      {marker !== undefined && (
        <span
          aria-hidden
          className="absolute -bottom-1 -top-0.5 w-0.5 bg-card"
          style={{ left: `${Math.min(100, Math.max(0, marker))}%` }}
        />
      )}
    </div>
  );
}
