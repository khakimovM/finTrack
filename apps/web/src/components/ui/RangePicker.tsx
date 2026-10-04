import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDate, formatDayMonth, formatRange, MONTHS, WEEKDAYS_SHORT, weekdayIndex } from '../../lib/format';
import { Button } from './Button';

export interface DateRange {
  from: string;
  to: string;
}

export interface RangePickerProps {
  value: DateRange | null;
  onApply: (range: DateRange) => void;
  onCancel: () => void;
  /** Latest selectable day (usually today). */
  max?: string;
  /** Phone sheet: 44px days, full-width buttons. */
  size?: 'md' | 'lg';
  className?: string;
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function daysIn(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/**
 * Month calendar starting on Monday. The first click sets the start, the second the end (swapped
 * if earlier); "Qo‘llash" applies the draft.
 */
export function RangePicker({ value, onApply, onCancel, max, size = 'md', className }: RangePickerProps) {
  const anchor = value?.from ?? max ?? new Date().toISOString().slice(0, 10);
  const [view, setView] = React.useState(() => ({ y: Number(anchor.slice(0, 4)), m: Number(anchor.slice(5, 7)) }));
  const [from, setFrom] = React.useState<string | null>(value?.from ?? null);
  const [to, setTo] = React.useState<string | null>(value?.to ?? null);

  const pick = (day: string) => {
    if (!from || to) {
      setFrom(day);
      setTo(null);
      return;
    }
    if (day < from) {
      setTo(from);
      setFrom(day);
    } else {
      setTo(day);
    }
  };

  const step = (delta: number) =>
    setView(({ y, m }) => {
      const date = new Date(y, m - 1 + delta, 1);
      return { y: date.getFullYear(), m: date.getMonth() + 1 };
    });

  const total = daysIn(view.y, view.m);
  const nextMonthStart = view.m === 12 ? iso(view.y + 1, 1, 1) : iso(view.y, view.m + 1, 1);
  const lead = weekdayIndex(iso(view.y, view.m, 1));
  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => iso(view.y, view.m, i + 1)),
  ];

  const draftText = from && to ? formatRange(from, to) : from ? `${formatDayMonth(from)} — tugash kunini tanlang` : 'Boshlanish kunini tanlang';
  const big = size === 'lg';

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Oldingi oy"
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-secondary focus-ring"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <span className="text-[14px] font-semibold capitalize" aria-live="polite">
          {MONTHS[view.m - 1]} {view.y}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Keyingi oy"
          disabled={Boolean(max && nextMonthStart > max)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-secondary focus-ring disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center" role="group" aria-label="Kalendar">
        {WEEKDAYS_SHORT.map((day) => (
          <span key={day} className="pb-1 text-[12px] font-medium text-text-muted">
            {day}
          </span>
        ))}
        {cells.map((day, index) => {
          if (!day) return <span key={`blank-${index}`} />;
          const disabled = Boolean(max && day > max);
          const isStart = day === from;
          const isEnd = day === to;
          const inRange = Boolean(from && to && day > from && day < to);
          const col = index % 7;
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => pick(day)}
              aria-label={formatDate(day)}
              aria-pressed={isStart || isEnd}
              className={cn(
                'text-[13px] tabular-nums transition-colors duration-fast focus-ring disabled:cursor-not-allowed disabled:opacity-30',
                big ? 'h-11 text-[14px]' : 'h-[38px]',
                isStart || isEnd
                  ? 'rounded-full bg-primary font-semibold text-primary-foreground'
                  : inRange
                    ? cn('bg-secondary', col === 0 && 'rounded-l-full', col === 6 && 'rounded-r-full')
                    : 'rounded-full hover:bg-secondary',
                day === max && !isStart && !isEnd && 'font-semibold',
              )}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
      <div className={cn('flex items-center gap-2 pt-1', big && 'flex-col items-stretch')}>
        <span className="min-w-0 flex-1 text-[13px] text-text-secondary">{draftText}</span>
        <div className={cn('flex gap-2', big && 'grid grid-cols-2')}>
          <Button variant="secondary" size={big ? 'lg' : 'sm'} onClick={onCancel}>
            {big ? 'Bekor qilish' : 'Bekor'}
          </Button>
          <Button
            size={big ? 'lg' : 'sm'}
            disabled={!from || !to}
            onClick={() => from && to && onApply({ from, to })}
          >
            Qo‘llash
          </Button>
        </div>
      </div>
    </div>
  );
}
