import * as React from 'react';
import { somToTiyin, tiyinToSom } from '@fintrack/shared';
import { cn } from '../../lib/utils';
import { NBSP } from '../../lib/money';
import { Field, useFieldId } from './Field';

export interface MoneyChip {
  label: string;
  /** Tiyin string the chip fills in. */
  value: string;
}

export interface MoneyInputProps {
  label?: string;
  error?: string;
  hint?: string;
  /** Tiyin string, e.g. "150000000" for 1 500 000 so‘m. */
  value?: string;
  onChange?: (tiyin: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** lg: transaction form (64px), md: other forms (60px), sm: opening balance and filters (48px). */
  size?: 'lg' | 'md' | 'sm';
  chips?: MoneyChip[];
  className?: string;
  wrapperClassName?: string;
  id?: string;
  'aria-label'?: string;
}

const SIZE = {
  lg: { box: 'h-16 px-4', text: 'text-[28px] tracking-[-0.02em]', unit: 'text-[17px]' },
  md: { box: 'h-[60px] px-4', text: 'text-[26px] tracking-[-0.02em]', unit: 'text-[16px]' },
  sm: { box: 'h-12 px-3.5', text: 'text-[17px]', unit: 'text-[15px]' },
} as const;

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

/** Tiyin → what the field shows: "1 500 000", "1 500,50"; empty for zero. */
export function displayFromTiyin(tiyin?: string): string {
  if (!tiyin || tiyin === '0') return '';
  try {
    const [whole, frac] = tiyinToSom(tiyin).split('.');
    return frac && frac !== '00' ? `${group(whole)},${frac}` : group(whole);
  } catch {
    return '';
  }
}

/**
 * Amounts in so‘m with live grouping. The value is tiyin, so floats never touch money: the text is
 * parsed with somToTiyin. A comma or dot starts the (at most two) tiyin digits.
 */
export function MoneyInput({
  label,
  error,
  hint,
  value,
  onChange,
  placeholder = '0',
  disabled = false,
  autoFocus,
  size = 'md',
  chips,
  className,
  wrapperClassName,
  id,
  'aria-label': ariaLabel,
}: MoneyInputProps) {
  const inputId = useFieldId(id);
  const [display, setDisplay] = React.useState(() => displayFromTiyin(value));
  const lastEmitted = React.useRef(value);

  // Follow outside changes (form reset, a chip) but not the echo of our own typing, which would
  // swallow a trailing comma the user is in the middle of typing.
  React.useEffect(() => {
    if (value !== lastEmitted.current) {
      setDisplay(displayFromTiyin(value));
      lastEmitted.current = value;
    }
  }, [value]);

  const emit = (tiyin: string) => {
    lastEmitted.current = tiyin;
    onChange?.(tiyin);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/[^\d.,]/g, '').replace(/\./g, ',');
    if (!clean) {
      setDisplay('');
      emit('0');
      return;
    }
    const [wholeRaw, ...rest] = clean.split(',');
    const whole = (wholeRaw.replace(/^0+(?=\d)/, '') || '0').slice(0, 15);
    const hasComma = rest.length > 0;
    const frac = rest.join('').slice(0, 2);
    setDisplay(group(whole) + (hasComma ? `,${frac}` : ''));
    try {
      emit(somToTiyin(frac ? `${whole}.${frac}` : whole).toString());
    } catch {
      // A half-typed value; the next keystroke completes it.
    }
  };

  const s = SIZE[size];
  return (
    <Field id={inputId} label={label} hint={hint} error={error} className={wrapperClassName}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-input bg-card shadow-xs transition-[border-color,box-shadow] duration-fast field-focus',
          s.box,
          error && 'border-danger',
          disabled && 'border-border bg-surface',
          className,
        )}
      >
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          value={display}
          onChange={handleChange}
          aria-label={label ? undefined : ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            'h-full w-full min-w-0 flex-1 bg-transparent text-right font-semibold tabular-nums text-text outline-none placeholder:text-text-muted disabled:cursor-not-allowed disabled:text-text-muted',
            s.text,
          )}
        />
        <span className={cn('shrink-0 font-medium text-text-muted', s.unit)} aria-hidden>
          so‘m
        </span>
      </div>
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={disabled}
              onClick={() => {
                setDisplay(displayFromTiyin(chip.value));
                emit(chip.value);
              }}
              className="h-8 rounded-full border border-input px-3 text-[13px] font-medium text-text hover:bg-secondary focus-ring disabled:opacity-40"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}
