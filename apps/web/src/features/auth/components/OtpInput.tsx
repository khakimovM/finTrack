import { useRef, useState } from 'react';
import { cn } from '../../../lib/utils';

const LENGTH = 6;

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called once all six digits are present (typed or pasted). */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}

/**
 * Six boxes drawn over one transparent input: paste, autofill of SMS/Telegram codes
 * (autocomplete="one-time-code") and the platform keyboard all work as in a single field.
 */
export function OtpInput({ value, onChange, onComplete, disabled, invalid, autoFocus = true }: OtpInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');
  const activeIndex = Math.min(value.length, LENGTH - 1);

  return (
    <div className="relative" onClick={() => inputRef.current?.focus()}>
      {/* A wrong code shakes the boxes, the way a rejected password field does. */}
      <div className={cn('grid grid-cols-6 gap-2', invalid && 'animate-ft-shake')} aria-hidden>
        {digits.map((digit, i) => {
          const active = !disabled && !invalid && (focused || value.length === 0) && i === activeIndex && value.length < LENGTH;
          return (
            <span
              key={i}
              className={cn(
                'relative flex h-[58px] items-center justify-center rounded-md border text-[24px] font-semibold tabular-nums transition-[border-color,box-shadow] duration-fast',
                invalid ? 'border-danger' : active ? 'border-ring shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)]' : 'border-input',
                digit || active ? 'bg-card' : 'bg-surface',
              )}
            >
              {digit}
              {active && !digit && <span className="h-6 w-[1.5px] animate-ft-caret bg-text" />}
            </span>
          );
        })}
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          const clean = e.target.value.replace(/\D/g, '').slice(0, LENGTH);
          onChange(clean);
          if (clean.length === LENGTH) onComplete?.(clean);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        autoFocus={autoFocus}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={LENGTH}
        aria-label="6 xonali kod"
        aria-invalid={invalid || undefined}
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-[16px] text-transparent caret-transparent outline-none selection:bg-transparent disabled:cursor-not-allowed"
      />
    </div>
  );
}
