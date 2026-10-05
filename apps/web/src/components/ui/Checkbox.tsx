import { Check, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface CheckboxProps {
  checked: boolean;
  /** Some but not all rows selected (table header). */
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  'aria-label': string;
}

/** 20px box, radius 6; the 44px hit area comes from the caller's row or cell. */
export function Checkbox({ checked, indeterminate, onChange, disabled, className, ...aria }: CheckboxProps) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] transition-colors duration-fast focus-ring disabled:cursor-not-allowed disabled:opacity-40',
        on ? 'bg-primary text-primary-foreground' : 'border-[1.5px] border-input bg-card',
        className,
      )}
      {...aria}
    >
      {indeterminate ? (
        <Minus className="h-3 w-3" strokeWidth={3.2} aria-hidden />
      ) : checked ? (
        <Check className="h-3 w-3" strokeWidth={3.2} aria-hidden />
      ) : null}
    </button>
  );
}
