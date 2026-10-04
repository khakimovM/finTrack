import * as React from 'react';
import { cn } from '../../lib/utils';
import { Field, useFieldId } from './Field';
import { EmojiTile } from './EmojiTile';

export interface ChoiceOption {
  value: string;
  label: React.ReactNode;
  /** Muted second line ("Balans: 12 550 000 so‘m", "Byudjet bor"). */
  sub?: React.ReactNode;
  emoji?: string;
  /** Stored colour for the emoji tile. */
  color?: string | null;
  disabled?: boolean;
}

export interface ChoiceGridProps {
  label?: string;
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  /** Columns from the tablet up; phones use phoneColumns. */
  columns?: 1 | 2 | 3 | 4 | 7;
  phoneColumns?: 1 | 2 | 3 | 4 | 7;
  /** sm: compact cells (week/month days). */
  size?: 'md' | 'sm';
  error?: string;
  hint?: string;
  className?: string;
}

const COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  7: 'grid-cols-7',
};
const SM_COLS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  7: 'sm:grid-cols-7',
};

/** Radio buttons laid out as cards: ring and a 6% tint on the chosen one. */
export function ChoiceGrid({
  label,
  options,
  value,
  onChange,
  columns = 2,
  phoneColumns = 1,
  size = 'md',
  error,
  hint,
  className,
}: ChoiceGridProps) {
  const groupId = useFieldId();
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    for (let i = 1; i <= options.length; i += 1) {
      const next = (index + delta * i + options.length) % options.length;
      if (!options[next].disabled) {
        onChange(options[next].value);
        refs.current[next]?.focus();
        return;
      }
    }
  };

  const compact = size === 'sm';
  return (
    <Field id={groupId} label={label} error={error} hint={hint} className={className}>
      <div
        role="radiogroup"
        aria-label={typeof label === 'string' ? label : undefined}
        className={cn('grid gap-1.5', COLS[phoneColumns], SM_COLS[columns])}
      >
        {options.map((option, index) => {
          const on = option.value === value;
          return (
            <button
              key={option.value}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on || (!value && index === 0) ? 0 : -1}
              disabled={option.disabled}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'flex items-center gap-2.5 rounded-md border text-left text-[14px] font-medium transition-[border-color,box-shadow,background-color] duration-fast focus-ring disabled:cursor-not-allowed disabled:opacity-40',
                compact ? 'min-h-[38px] justify-center px-1.5 text-[13px]' : 'min-h-[52px] py-1.5 pl-2 pr-3',
                !option.emoji && !compact && 'pl-3.5',
                on
                  ? 'border-ring bg-[color-mix(in_oklab,var(--ring)_6%,var(--card))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_22%,transparent)]'
                  : 'border-input bg-card hover:bg-surface',
              )}
            >
              {option.emoji && <EmojiTile emoji={option.emoji} color={option.color} size={32} />}
              <span className={cn('flex min-w-0 flex-col', compact && 'items-center')}>
                <span className="truncate">{option.label}</span>
                {option.sub && <span className="truncate text-[12px] font-normal leading-4 text-text-muted">{option.sub}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}
