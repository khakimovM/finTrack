import * as React from 'react';
import { Calendar } from 'lucide-react';
import { todayLocalIso } from '@fintrack/shared';
import { cn } from '../../lib/utils';
import { formatDate } from '../../lib/format';
import { Field, useFieldId } from './Field';

export type DateChip = 'today' | 'yesterday' | 'none';

export interface DatePickerProps {
  label?: string;
  /** "YYYY-MM-DD", or "" for no date (with the "none" chip). */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  chips?: DateChip[];
  /** Label of the "none" chip ("Muddatsiz"). */
  noneLabel?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  /** The user's today (time zone aware); defaults to the device's. */
  today?: string;
  className?: string;
  id?: string;
}

function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Quick chips plus a field that reads "3-oktabr, 2026". The native date input sits invisibly on
 * top of the field, so phones get their own picker and ISO stays inside the input's value.
 */
export function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  chips = [],
  noneLabel = 'Muddatsiz',
  placeholder = 'Sanani tanlang',
  error,
  hint,
  today = todayLocalIso(),
  className,
  id,
}: DatePickerProps) {
  const fieldId = useFieldId(id);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const yesterday = shift(today, -1);

  const chipValue: Record<DateChip, string> = { today, yesterday, none: '' };
  const chipLabel: Record<DateChip, string> = { today: 'Bugun', yesterday: 'Kecha', none: noneLabel };

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker?.();
    } catch {
      // Older browsers open the picker on focus/click by themselves.
    }
  };

  return (
    <Field id={fieldId} label={label} error={error} hint={hint} className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => {
          const on = value === chipValue[chip];
          return (
            <button
              key={chip}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(chipValue[chip])}
              className={cn(
                'h-10 rounded-full px-4 text-[14px] font-medium transition-colors duration-fast focus-ring',
                on ? 'bg-primary text-primary-foreground' : 'border border-input text-text hover:bg-secondary',
              )}
            >
              {chipLabel[chip]}
            </button>
          );
        })}
        <div
          className={cn(
            'relative flex h-11 min-w-[200px] flex-1 items-center gap-2.5 rounded-md border bg-card px-3.5 shadow-xs field-focus',
            error ? 'border-danger' : 'border-input',
          )}
        >
          <Calendar className="h-[17px] w-[17px] shrink-0 text-text-muted" aria-hidden />
          <span className={cn('truncate text-[15px]', value ? 'text-text' : 'text-text-muted')} aria-hidden>
            {value ? formatDate(value) : placeholder}
          </span>
          <input
            ref={inputRef}
            id={fieldId}
            type="date"
            value={value}
            min={min}
            max={max}
            onChange={(e) => onChange(e.target.value)}
            onClick={openPicker}
            aria-label={label ? undefined : placeholder}
            aria-invalid={error ? true : undefined}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
      </div>
    </Field>
  );
}
