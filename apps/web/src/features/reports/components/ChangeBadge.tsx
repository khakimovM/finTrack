import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface ChangeBadgeProps {
  current: string;
  previous: string;
  percent: number;
  /** Whether growth is good news (income) or bad news (spending). */
  growthIsGood: boolean;
}

/**
 * "↑ 12,5%" coloured by whether the change is good for the user. The API reports +100% when the
 * previous period was zero, which reads as "doubled": that case is shown as "yangi" instead.
 */
export function ChangeBadge({ current, previous, percent, growthIsGood }: ChangeBadgeProps) {
  const cur = BigInt(current);
  const prev = BigInt(previous);
  if (cur === prev) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <Minus className="h-3.5 w-3.5" /> o‘zgarmadi
      </span>
    );
  }
  const up = cur > prev;
  const good = up === growthIsGood;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const text =
    prev === 0n
      ? 'yangi'
      : `${Math.abs(percent).toLocaleString('uz-UZ', { maximumFractionDigits: 1 })}%`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-bold',
        good ? 'text-success' : 'text-destructive',
      )}
      aria-label={`${up ? 'o‘sdi' : 'kamaydi'}: ${text}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {text}
    </span>
  );
}
