import * as React from 'react';
import { cn } from '../../lib/utils';
import { somToTiyin, tiyinToSom } from '@fintrack/shared';

export interface MoneyInputProps {
  label?: string;
  error?: string;
  value?: string; // tiyin string (e.g., "150000000")
  onChange?: (tiyinStr: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function MoneyInput({
  label,
  error,
  value,
  onChange,
  placeholder = '0',
  disabled = false,
  className,
  id,
}: MoneyInputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  // Convert incoming tiyin string to display som string
  const formatTiyinToDisplay = (tiyinStr?: string): string => {
    if (!tiyinStr || tiyinStr === '0') return '';
    try {
      const somDecimal = tiyinToSom(tiyinStr);
      const [whole, frac] = somDecimal.split('.');
      const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return frac && frac !== '00' ? `${formattedWhole},${frac}` : formattedWhole;
    } catch {
      return '';
    }
  };

  const [displayValue, setDisplayValue] = React.useState<string>(() =>
    formatTiyinToDisplay(value),
  );

  React.useEffect(() => {
    setDisplayValue(formatTiyinToDisplay(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits, commas, dots and spaces
    const clean = raw.replace(/[^\d.,]/g, '').replace(',', '.');

    if (!clean) {
      setDisplayValue('');
      onChange?.('0');
      return;
    }

    const [wholePart, fracPart] = clean.split('.');
    const cleanWhole = wholePart ? wholePart.replace(/^0+(?=\d)/, '') : '0';
    const formattedWhole = cleanWhole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    let newDisplay = formattedWhole;
    if (clean.includes('.')) {
      newDisplay += ',' + (fracPart ?? '').slice(0, 2);
    }
    setDisplayValue(newDisplay);

    try {
      const somStr = cleanWhole + (fracPart ? '.' + fracPart.slice(0, 2) : '');
      const tiyin = somToTiyin(somStr);
      onChange?.(tiyin.toString());
    } catch {
      // Invalid temporary input
    }
  };

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold tracking-wide uppercase text-muted-foreground"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          placeholder={placeholder}
          value={displayValue}
          onChange={handleChange}
          className={cn(
            'flex h-12 w-full rounded-xl border border-input bg-surface pl-4 pr-16 text-right text-base font-bold text-foreground transition-all duration-150 placeholder:text-muted focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30',
            className,
          )}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
          so‘m
        </span>
      </div>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
