import { useRef } from 'react';
import { cn } from '../../../lib/utils';

const LENGTH = 6;

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called once all six digits are present (typed or pasted). */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}

/** Six single-digit boxes that behave like one field: paste, arrows and backspace all work. */
export function OtpInput({ value, onChange, onComplete, disabled, invalid }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, LENGTH);
    onChange(clean);
    if (clean.length === LENGTH) onComplete?.(clean);
    return clean;
  };

  const focus = (index: number) => refs.current[Math.max(0, Math.min(LENGTH - 1, index))]?.focus();

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Tasdiqlash kodi">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          value={digit}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`${index + 1}-raqam`}
          aria-invalid={invalid || undefined}
          className={cn(
            'h-14 w-11 sm:w-12 rounded-xl border bg-surface text-center text-2xl font-bold text-foreground',
            'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            invalid ? 'border-destructive' : 'border-input focus-visible:border-primary',
            'disabled:opacity-50',
          )}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, '');
            if (!typed) return;
            // Mobile keyboards may insert the whole code into one box.
            const merged = (value.slice(0, index) + typed + value.slice(index + typed.length)).slice(0, LENGTH);
            const clean = commit(merged);
            focus(Math.min(index + typed.length, clean.length));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (digit) {
                commit(value.slice(0, index) + value.slice(index + 1));
              } else if (index > 0) {
                commit(value.slice(0, index - 1) + value.slice(index));
                focus(index - 1);
              }
            } else if (e.key === 'ArrowLeft') {
              focus(index - 1);
            } else if (e.key === 'ArrowRight') {
              focus(index + 1);
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const clean = commit(e.clipboardData.getData('text'));
            focus(clean.length);
          }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
